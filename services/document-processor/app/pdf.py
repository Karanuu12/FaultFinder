"""PDF → text + page/section metadata extraction."""
from __future__ import annotations

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


def extract_pdf_pages(raw: bytes) -> list[dict[str, Any]]:
    """Return a list of {page, section, text} for a raw PDF byte buffer.

    Prefers PyMuPDF for structural extraction and falls back to pypdf.
    Either backend fails, an exception propagates to the caller (HTTP 422).
    """
    if _MUPDF and pymupdf is not None:
        return _extract_mupdf(raw)
    if _PYPDF and PdfReader is not None:
        return _extract_pypdf(raw)
    raise RuntimeError("No PDF backend available (install pymupdf or pypdf).")


def _extract_mupdf(raw: bytes) -> list[dict[str, Any]]:
    doc = pymupdf.open(stream=raw, filetype="pdf")  # type: ignore[attr-defined]
    pages: list[dict[str, Any]] = []
    for idx, page in enumerate(doc, start=1):
        text = page.get_text("text", sort=True).strip()
        if not text:
            continue
        pages.append({"page": idx, "section": _detect_section(text), "text": text})
    return pages


def _extract_pypdf(raw: bytes) -> list[dict[str, Any]]:
    import io

    reader = PdfReader(io.BytesIO(raw))  # type: ignore[attr-defined]
    pages: list[dict[str, Any]] = []
    for idx, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        pages.append({"page": idx, "section": _detect_section(text), "text": text})
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