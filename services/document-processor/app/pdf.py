"""PDF → text + page/section metadata + embedded image extraction + OCR."""
from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Any

try:  # PyMuPDF: best structural fidelity (tables, glyphs)
    import pymupdf  # type: ignore[import-not-found]

    _MUPDF = True
except Exception:  # pragma: no cover
    _MUPDF = False
    pymupdf = None  # type: ignore[assignment]

try:  # pypdf fallback
    from pypdf import PdfReader  # type: ignore[import-not-found]

    _PYPDF = True
except Exception:  # pragma: no cover
    _PYPDF = False
    PdfReader = None  # type: ignore[assignment]

try:
    import pytesseract  # type: ignore[import-not-found]
    from PIL import Image  # type: ignore[import-not-found]

    _OCR = True
except Exception:  # pragma: no cover
    _OCR = False
    pytesseract = None  # type: ignore[assignment]
    Image = None  # type: ignore[assignment]


MAX_IMAGE_SIZE = 500 * 1024  # 500 KB per image
OCR_MIN_CHARS = 20  # if a page has fewer chars than this, run OCR


def extract_pdf_pages(
    raw: bytes,
    include_images: bool = False,
    use_ocr: bool = False,
) -> list[dict[str, Any]]:
    """Return a list of {page, section, text, images} for a raw PDF byte buffer.

    `images` is a list of base64-encoded JPEG/PNG thumbnails extracted from the page.
    Image extraction is opt-in: decoding every raster on a 170-page manual is slow,
    memory-hungry, and produces a response hundreds of megabytes large.

    When `use_ocr` is True, pages with very little extracted text will be
    re-processed through Tesseract OCR (renders the page as an image, runs OCR).
    """
    if _MUPDF and pymupdf is not None:
        return _extract_mupdf(raw, include_images=include_images, use_ocr=use_ocr)
    if _PYPDF and PdfReader is not None:
        return _extract_pypdf(raw)
    raise RuntimeError("No PDF backend available (install pymupdf or pypdf).")


def _extract_mupdf(
    raw: bytes,
    include_images: bool = False,
    use_ocr: bool = False,
) -> list[dict[str, Any]]:
    doc = pymupdf.open(stream=raw, filetype="pdf")  # type: ignore[attr-defined]
    pages: list[dict[str, Any]] = []
    for idx, page in enumerate(doc, start=1):
        text = page.get_text("text", sort=True).strip()
        images = _extract_images(page, page_number=idx) if include_images else []

        # OCR fallback: if page has very little text, render and OCR
        if use_ocr and len(text) < OCR_MIN_CHARS and _OCR and pytesseract is not None and Image is not None:
            try:
                pix = page.get_pixmap(dpi=200)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                ocr_text = pytesseract.image_to_string(img).strip()
                if ocr_text:
                    text = ocr_text
            except Exception:
                pass  # keep original text if OCR fails

        pages.append({
            "page": idx,
            "section": _detect_section(text),
            "text": text,
            "images": images,
        })
    return pages


def _extract_images(page: pymupdf.Page, page_number: int) -> list[str]:
    """Extract embedded images from a page as base64 JPEG thumbnails.

    Returns up to 3 largest images per page, each <= MAX_IMAGE_SIZE.

    get_images() returns (xref, smask, width, height, bpc, colorspace, ...) --
    width/height are already known from the PDF's own image dict, so we filter
    on size BEFORE building a Pixmap. Decoding first and checking after (the
    previous approach) means every icon and logo on every page pays the full
    decode cost only to be thrown away; on a 300+ page manual with a header
    logo on each page that's hundreds of wasted decodes per ingest.
    """
    image_list = page.get_images(full=True)
    candidates: list[tuple[int, int]] = []  # (xref, area) -- cheap pre-filter

    for img_info in image_list:
        xref = img_info[0]
        width = img_info[2] if len(img_info) > 2 else 0
        height = img_info[3] if len(img_info) > 3 else 0
        if width and height:
            if width < 50 or height < 50 or width > 2000 or height > 2000:
                continue
            candidates.append((xref, width * height))
        else:
            # Metadata didn't carry dimensions (rare) -- decode as a fallback
            # rather than silently dropping a potentially real figure.
            candidates.append((xref, 0))

    # Decode largest-first and stop once we have 3 that survive the real
    # (post-decode) size check, instead of decoding every candidate.
    candidates.sort(key=lambda c: -c[1])
    extracted: list[tuple[int, bytes]] = []

    for xref, _ in candidates:
        if len(extracted) >= 3:
            break
        try:
            # PyMuPDF takes (doc, xref) positionally; the keyword form raises
            # "Pixmap.__init__() got an unexpected keyword argument 'doc'".
            pix = pymupdf.Pixmap(page.parent, xref)  # type: ignore[attr-defined]
            if pix.width < 50 or pix.height < 50 or pix.width > 2000 or pix.height > 2000:
                continue

            pix = pymupdf.Pixmap(pix, 0)  # remove alpha if present  # type: ignore[attr-defined]
            img_bytes = pix.tobytes("jpeg", jpg_quality=70)
            if len(img_bytes) > MAX_IMAGE_SIZE:
                continue

            extracted.append((pix.width * pix.height, img_bytes))
        except Exception:
            continue

    extracted.sort(key=lambda x: -x[0])
    result: list[str] = []
    for _, img_bytes in extracted[:3]:
        b64 = base64.b64encode(img_bytes).decode("ascii")
        result.append(f"data:image/jpeg;base64,{b64}")

    # Fallback: technical wiring/terminal diagrams in these manuals are very
    # often drawn with PDF vector primitives (lines, rects, filled shapes) --
    # a "screenshot" of the drawing, not an embedded JPEG/PNG. get_images()
    # cannot see those at all, so a page can have a real, important diagram
    # and still legitimately return zero embedded images. When that happens,
    # look for a page region with dense vector drawing and rasterize just
    # that region as an image instead.
    if len(result) < 3:
        result.extend(_rasterize_vector_diagram(page, slots=3 - len(result)))

    return result


# A page's drawing operations are grouped by spatial proximity before any
# other check runs. Unioning ALL of a page's vector drawings into one bbox
# (the first version of this) means a header rule, a CAUTION box border, a
# sidebar tab, and an actual diagram all merge into one "region" spanning
# nearly the whole page -- which both fails to isolate the real diagram and
# dilutes the text-density check below (a table's dense text gets diluted by
# all the surrounding blank page space pulled into the same bbox). Clustering
# first, then scoring each cluster on its own, is what makes both checks mean
# anything.
CLUSTER_GAP = 12  # points; drawings within this distance join the same cluster
MIN_CLUSTER_OPS = 20  # below this, it's a box border or a couple of rules
MIN_DIAGRAM_SIZE = 60  # points, each dimension -- rejects tiny decorative marks
MAX_WORD_DENSITY = 7.0  # distinct words per sq-inch inside the cluster; tables run denser
MIN_OPS_DENSITY = 4.0  # drawing primitives per sq-inch -- the real discriminator.
# Page furniture (separator rules, language tabs, a table's row/column lines)
# tends to be a handful of primitives spread across a LARGE area -- a cover
# page's rules-plus-tabs cluster measured 1.7 ops/sqin, a dense parameter
# table 0.9-2.4. An actual wiring diagram packs many primitives into a
# comparatively small area: a real terminal wiring schematic measured
# 6.8 ops/sqin. Word density alone isn't enough -- a labelled schematic (many
# short terminal names: L1, L2, R1A, LI1...) can score similarly to a sparse
# table on word density alone, which is why both checks apply together.


def _cluster_drawings(rects: list["pymupdf.Rect"]) -> list[dict[str, Any]]:
    """Group drawing-primitive rects into spatial clusters (simple agglomerative merge)."""
    clusters: list[dict[str, Any]] = []
    for r in rects:
        expanded = pymupdf.Rect(r.x0 - CLUSTER_GAP, r.y0 - CLUSTER_GAP, r.x1 + CLUSTER_GAP, r.y1 + CLUSTER_GAP)
        hit = next((c for c in clusters if expanded.intersects(c["bbox"])), None)
        if hit:
            hit["bbox"] |= r
            hit["count"] += 1
        else:
            clusters.append({"bbox": pymupdf.Rect(r), "count": 1})

    # A first merge pass can leave adjacent clusters now touching each other;
    # repeat until stable. Bounded by len(clusters) which is already small.
    merged = True
    while merged:
        merged = False
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                a, b = clusters[i], clusters[j]
                expanded = pymupdf.Rect(
                    a["bbox"].x0 - CLUSTER_GAP, a["bbox"].y0 - CLUSTER_GAP,
                    a["bbox"].x1 + CLUSTER_GAP, a["bbox"].y1 + CLUSTER_GAP,
                )
                if expanded.intersects(b["bbox"]):
                    a["bbox"] |= b["bbox"]
                    a["count"] += b["count"]
                    clusters.pop(j)
                    merged = True
                    break
            if merged:
                break
    return clusters


def _rasterize_vector_diagram(page: pymupdf.Page, slots: int) -> list[str]:
    """Detect a vector-drawn diagram on the page and render just that region.

    Distinguishing "a wiring diagram" from "a bordered table" (which also
    uses straight vector rule lines) matters: rasterizing every ruled table
    would duplicate what the markdown table extractor already does better,
    and rasterizing page furniture (rules, boxes, sidebar tabs) is just
    noise. Real diagrams cluster densely (many line/shape primitives close
    together) and are text-sparse (a few short labels, not sentences); a
    table clusters just as densely but is text-dense.
    """
    if slots <= 0:
        return []
    try:
        drawings = page.get_drawings()
    except Exception:
        return []

    rects = [d["rect"] for d in drawings if d.get("rect") and not d["rect"].is_empty]
    if len(rects) < MIN_CLUSTER_OPS:
        return []

    clusters = _cluster_drawings(rects)
    # Evaluate candidates largest-op-count first; use the first one that
    # survives the size + text-density checks rather than always taking #1,
    # so a big dense table cluster doesn't block a smaller real diagram
    # elsewhere on the same page.
    clusters.sort(key=lambda c: -c["count"])

    page_rect = page.rect
    for c in clusters[:5]:
        if c["count"] < MIN_CLUSTER_OPS:
            break  # sorted descending -- nothing after this qualifies either

        pad = 6
        bbox = pymupdf.Rect(c["bbox"].x0 - pad, c["bbox"].y0 - pad, c["bbox"].x1 + pad, c["bbox"].y1 + pad)
        bbox.x0 = max(bbox.x0, page_rect.x0)
        bbox.y0 = max(bbox.y0, page_rect.y0)
        bbox.x1 = min(bbox.x1, page_rect.x1)
        bbox.y1 = min(bbox.y1, page_rect.y1)

        if bbox.width < MIN_DIAGRAM_SIZE or bbox.height < MIN_DIAGRAM_SIZE:
            continue
        # A cluster spanning nearly the full page is page furniture (a full
        # frame/rule), not a contained diagram -- skip it, don't rasterize
        # the whole page as a fallback.
        if bbox.width > 0.92 * page_rect.width and bbox.height > 0.92 * page_rect.height:
            continue

        sq_inches = max(0.01, (bbox.width / 72) * (bbox.height / 72))

        # Positive signal: a real diagram packs many drawing primitives into
        # a comparatively small area. Page furniture (separator rules, a
        # table's row/column lines) is a handful of primitives spread across
        # a much larger area, even though the raw op COUNT can look similar.
        if c["count"] / sq_inches < MIN_OPS_DENSITY:
            continue

        try:
            # Word COUNT, not character count: a table cell holding "10" or
            # "HSP" is short, so raw character density stays low even though
            # the region is packed with distinct data points. Word density
            # catches that; a real diagram has only a handful of scattered
            # labels no matter how it's measured.
            words_in_region = page.get_text("words", clip=bbox) or []
        except Exception:
            words_in_region = []
        if len(words_in_region) / sq_inches > MAX_WORD_DENSITY:
            continue  # word-dense -- a table or a text block, not a diagram

        try:
            pix = page.get_pixmap(clip=bbox, dpi=150)  # type: ignore[call-arg]
            img_bytes = pix.tobytes("jpeg", jpg_quality=75)
            if len(img_bytes) > MAX_IMAGE_SIZE:
                pix = page.get_pixmap(clip=bbox, dpi=100)  # type: ignore[call-arg]
                img_bytes = pix.tobytes("jpeg", jpg_quality=65)
            if len(img_bytes) > MAX_IMAGE_SIZE:
                continue
            b64 = base64.b64encode(img_bytes).decode("ascii")
            return [f"data:image/jpeg;base64,{b64}"][:slots]
        except Exception:
            continue

    return []


def _extract_pypdf(raw: bytes) -> list[dict[str, Any]]:
    reader = PdfReader(io.BytesIO(raw))  # type: ignore[attr-defined]
    pages: list[dict[str, Any]] = []
    for idx, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        pages.append({
            "page": idx,
            "section": _detect_section(text),
            "text": text,
            "images": [],  # pypdf doesn't support image extraction easily
        })
    return pages


def _detect_section(text: str) -> str:
    """Best-effort section title = the first short heading-like line."""
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if len(line) <= 80 and not line.endswith(".") and _looks_like_heading(line):
            return line
    return ""


def _looks_like_heading(line: str) -> bool:
    lowered = line.lower()
    markers = ("§", "section", "chapter", "table of contents", "error", "troubleshooting")
    if any(m in lowered for m in markers):
        return True
    # Uppercase-heavy short line (e.g. "E101 – OVERHEAT")
    upper = sum(1 for c in line if c.isupper())
    letters = sum(1 for c in line if c.isalpha())
    if letters and upper / letters > 0.6:
        return True
    return False

def extract_outline(raw: bytes) -> list[dict[str, Any]]:
    """Return the PDF's embedded bookmark tree as [{title, page_pdf, level}].

    Every vendor manual in this corpus (ABB, Schneider) ships a full outline with
    exact section titles and destination pages. Using it beats inferring headings
    from font sizes or text patterns: it is exact, free, and it is what makes a
    citation's section path trustworthy.
    """
    if not (_MUPDF and pymupdf is not None):
        return []
    try:
        doc = pymupdf.open(stream=raw, filetype="pdf")  # type: ignore[attr-defined]
        toc = doc.get_toc(simple=True) or []
    except Exception:  # noqa: BLE001 - a missing/broken outline is not fatal
        return []

    entries: list[dict[str, Any]] = []
    for item in toc:
        try:
            level, title, page = item[0], item[1], item[2]
        except (IndexError, TypeError):
            continue
        if not title or page is None or page < 1:
            continue
        entries.append({
            # get_toc levels are 1-based; callers want 0-based depth.
            "level": max(0, int(level) - 1),
            "title": str(title).strip(),
            "page_pdf": int(page),
        })
    return entries
