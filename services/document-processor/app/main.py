"""Timmo document processor.

Handles the heavy document-processing stage of the RAG pipeline:
PDF text extraction, page/section metadata, and heading-aware chunking.
Exposed as a small FastAPI service that Next.js calls during ingestion.
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import anyio

from .chunking import chunk_pages
from .embeddings import DIMS as EMBED_DIMS, embed_texts
from .pdf import extract_outline, extract_pdf_pages

app = FastAPI(
    title="Timmo Document Processor",
    version="0.1.0",
    description="PDF parsing, OCR, and chunking micro-service.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class Page(BaseModel):
    page: int = Field(ge=1)
    section: str = ""
    text: str = ""
    images: list[str] = Field(default_factory=list)


class OutlineEntry(BaseModel):
    title: str
    page_pdf: int
    level: int = 0


class ParseResponse(BaseModel):
    document_id: str
    title: str = ""
    total_pages: int = 0
    pages: list[Page] = []
    outline: list[OutlineEntry] = []


class ChunkRequest(BaseModel):
    document_id: str
    title: str = ""
    pages: list[Page]
    max_chars: int = Field(default=1800, ge=200, le=8000)
    overlap: int = Field(default=120, ge=0, le=800)


class Chunk(BaseModel):
    id: str
    document_id: str
    title: str
    page: int
    section: str
    text: str
    char_count: int = 0
    images: list[str] = Field(default_factory=list)


class ChunkResponse(BaseModel):
    chunks: list[Chunk]


class EmbedRequest(BaseModel):
    texts: list[str]
    task: str = "retrieval.passage"


class EmbedResponse(BaseModel):
    vectors: list[list[float]]
    dims: int


class HealthResponse(BaseModel):
    status: str
    service: str
    ready: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="document-processor", ready=True)


@app.post("/parse", response_model=ParseResponse)
async def parse_pdf(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    include_images: bool = Form(False),
) -> ParseResponse:
    """Extract text + page/section metadata from an uploaded PDF.

    `include_images` defaults to False on purpose: images come back as base64
    JPEGs, and on a 170+ page manual that turns a few megabytes of text into a
    several-hundred-megabyte JSON response. Callers that actually want figures
    opt in per request.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")

    try:
        pages = extract_pdf_pages(raw, include_images=include_images)
    except Exception as exc:  # noqa: BLE001 - surface any parse failure to caller
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {exc}") from exc

    if not pages:
        raise HTTPException(status_code=422, detail="No extractable text found in PDF.")

    return ParseResponse(
        document_id=document_id,
        title=file.filename,
        total_pages=len(pages),
        pages=pages,
        outline=extract_outline(raw),
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest) -> EmbedResponse:
    """Embed texts with the local model. No rate limit, no token budget."""
    if not request.texts:
        return EmbedResponse(vectors=[], dims=EMBED_DIMS)
    try:
        vectors = await anyio.to_thread.run_sync(
            lambda: embed_texts(request.texts, request.task)
        )
    except Exception as exc:  # noqa: BLE001 - surface load/inference failures to the caller
        raise HTTPException(status_code=500, detail=f"Local embedding failed: {exc}") from exc
    return EmbedResponse(vectors=vectors, dims=EMBED_DIMS)


@app.post("/chunk", response_model=ChunkResponse)
async def chunk(request: ChunkRequest) -> ChunkResponse:
    """Split a parsed document into semantic, heading-aware chunks."""
    with anyio.fail_after(15):
        return ChunkResponse(chunks=chunk_pages(request, max_chars=request.max_chars, overlap=request.overlap))


@app.post("/process", response_model=ChunkResponse)
async def process_pdf(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    max_chars: int = Form(1800),
    overlap: int = Form(120),
) -> ChunkResponse:
    """One-call convenience: parse then chunk a PDF."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    raw = await file.read()
    try:
        pages = extract_pdf_pages(raw)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {exc}") from exc

    if not pages:
        raise HTTPException(status_code=422, detail="No extractable text found in PDF.")

    parsed = ParseResponse(
        document_id=document_id,
        title=file.filename,
        total_pages=len(pages),
        pages=pages,
    )
    req = ChunkRequest(
        document_id=document_id,
        title=file.filename,
        pages=pages,
        max_chars=max_chars,
        overlap=overlap,
    )
    with anyio.fail_after(15):
        return ChunkResponse(chunks=chunk_pages(req, max_chars=max_chars, overlap=overlap))


def build_app() -> FastAPI:
    return app


# Re-export for FX/tooling that introspects via `fitz`/PdfReader.
__all__: list[str] = ["app", "build_app", "Page", "Chunk", "ParseResponse", "ChunkResponse"]