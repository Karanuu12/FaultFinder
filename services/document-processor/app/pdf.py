"""PDF → text + page/section metadata + embedded image extraction."""
from __future__ import annotations

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


MAX_IMAGE_SIZE = 500 * 1024  # 500 KB per image


def extract_pdf_pages(raw: bytes, include_images: bool = False) -> list[dict[str, Any]]:
    """Return a list of {page, section, text, images} for a raw PDF byte buffer.

    `images` is a list of base64-encoded JPEG/PNG thumbnails extracted from the page.
    Image extraction is opt-in: decoding every raster on a 170-page manual is slow,
    memory-hungry, and produces a response hundreds of megabytes large.
    """
    if _MUPDF and pymupdf is not None:
        return _extract_mupdf(raw, include_images=include_images)
    if _PYPDF and PdfReader is not None:
        return _extract_pypdf(raw)
    raise RuntimeError("No PDF backend available (install pymupdf or pypdf).")


def _extract_mupdf(raw: bytes, include_images: bool = False) -> list[dict[str, Any]]:
    doc = pymupdf.open(stream=raw, filetype="pdf")  # type: ignore[attr-defined]
    pages: list[dict[str, Any]] = []
    for idx, page in enumerate(doc, start=1):
        text = page.get_text("text", sort=True).strip()
        images = _extract_images(page, page_number=idx) if include_images else []
        pages.append({
            "page": idx,
            "section": _detect_section(text),
            "text": text,
            "images": images,
        })
    return pages


def _extract_images(page: pymupdf.Page, page_number: int) -> list[str]:
    """Extract embedded images from a page as base64 JPEG thumbnails.

    Returns up to 3 largest images per page, each ≤ MAX_IMAGE_SIZE.
    """
    import base64

    image_list = page.get_images()
    extracted: list[tuple[int, bytes]] = []

    for img_index, img_info in enumerate(image_list):
        xref = img_info[0]
        try:
            # PyMuPDF takes (doc, xref) positionally; the keyword form raises
            # "Pixmap.__init__() got an unexpected keyword argument 'doc'".
            pix = pymupdf.Pixmap(page.parent, xref)  # type: ignore[attr-defined]
            # Skip large or tiny images
            if pix.width < 50 or pix.height < 50:
                continue
            if pix.width > 2000 or pix.height > 2000:
                continue

            # Convert to JPEG bytes
            pix = pymupdf.Pixmap(pix, 0)  # remove alpha if present  # type: ignore[attr-defined]
            img_bytes = pix.tobytes("jpeg", jpg_quality=70)
            if len(img_bytes) > MAX_IMAGE_SIZE:
                continue

            extracted.append((pix.width * pix.height, img_bytes))
        except Exception:
            continue

    # Keep up to 3 largest images
    extracted.sort(key=lambda x: -x[0])
    result: list[str] = []
    for _, img_bytes in extracted[:3]:
        b64 = base64.b64encode(img_bytes).decode("ascii")
        result.append(f"data:image/jpeg;base64,{b64}")
    return result


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
