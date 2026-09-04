"""Heading-aware chunking with page/section metadata.

Keeps the "waste" (a heading, an error-code block, corrective steps) together
by splitting on structural boundaries first, then trimming to max_chars with a
small overlap so no context is lost at chunk edges.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

WINDOW = 6  # number of preceding lines to carry for context at a split point


def chunk_pages(req: Any, max_chars: int = 1800, overlap: int = 120) -> list[dict[str, Any]]:
    """Chunk a parsed document (list of {page, section, text}) into semantic chunks."""
    chunks: list[dict[str, Any]] = []
    section_stack: list[str] = []
    seen: set[str] = set()

    for page in req.pages or []:
        page_no = int(page.get("page", 1))
        section = str(page.get("section") or "")

        segments = _segment_page(page_no, page.get("text", ""))
        for seg_section, text in segments:
            active_section = "{}. {}".format(section, seg_section).strip(". ").strip() if seg_section else section
            for piece in _split_long(text, max_chars=max_chars, overlap=overlap):
                chunk = {
                    "id": _chunk_id(req.document_id, page_no, piece),
                    "document_id": req.document_id,
                    "title": req.title,
                    "page": page_no,
                    "section": active_section,
                    "text": piece.strip(),
                    "char_count": len(piece),
                }
                key = chunk["id"]
                if key in seen:
                    continue
                seen.add(key)
                chunks.append(chunk)

    return sorted(chunks, key=lambda c: (c["page"], c["section"], c["char_count"]))


def _segment_page(page_no: int, text: str) -> list[tuple[str, str]]:
    """Split a page into (section_heading, body). Keeps successive sections."""
    lines = (text or "").splitlines()
    segments: list[tuple[str, str]] = []
    buffer: list[str] = []
    current_section = ""

    def flush() -> None:
        body = "\n".join(buffer).strip()
        if body:
            segments.append((current_section, body))

    for line in lines:
        stripped = line.strip()
        if _is_section_heading(stripped):
            flush()
            buffer = []
            current_section = stripped
        else:
            buffer.append(line)

    flush()

    if not segments and text.strip():
        segments.append(("", text.strip()))

    return segments


_HEADING_RE = re.compile(r"^(?:[0-9]+(?:[.\-][0-9]+)*[)\.]?\s+|§\s*[0-9]+\b|\*\*\s*)")


def _is_section_heading(line: str) -> bool:
    if not line:
        return False
    if len(line) > 80:
        return False
    if _HEADING_RE.match(line):
        return True
    # E.g. "E101 — OVERHEAT", "Corrective Action", "Probable Causes"
    lowered = line.lower()
    keywords = ("error", "cause", "corrective", "section", "symptom", "prevention", "warning")
    if any(k in lowered for k in keywords) and not line.rstrip().endswith("."):
        return True
    return False


def _split_long(text: str, max_chars: int, overlap: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    pieces: list[str] = []
    rest = text
    while len(rest) > max_chars:
        cut = _find_cut(rest, max_chars)
        piece = rest[:cut].strip()
        pieces.append(piece)
        rest = rest[max(0, cut - overlap):]
    if rest.strip():
        pieces.append(rest.strip())
    return pieces


def _find_cut(text: str, max_chars: int) -> int:
    window = text[max_chars:max_chars + WINDOW].lower()
    for i, c in enumerate(window):
        if c == "\n":
            return max_chars + i + 1
    for i in range(max_chars, 0, -1):
        if text[i] in ".!?":
            return i + 1
    for i in range(min(max_chars, len(text)) - 1, 0, -1):
        if text[i] in " \t":
            return i
    return max_chars


def _chunk_id(document_id: str, page_no: int, text: str) -> str:
    digest = hashlib.sha256(f"{document_id}:{page_no}:{text[:256]}".encode()).hexdigest()[:12]
    return f"{document_id}-p{page_no}-{digest}"