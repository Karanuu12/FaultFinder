/**
 * POST /api/ingest — Upload and index a PDF manual.
 * Tries Python doc-processor (FastAPI) first, falls back to Node pdf-parse.
 */
import { NextRequest, NextResponse } from "next/server";
import { OllamaEmbeddingClient, RagPipeline, MemoryVectorStore } from "@timmo/rag";
import { makeVectorStore } from "@/lib/rag-store";
import { makeLLM } from "@/lib/rag-llm";

const PYTHON_URL = process.env.DOC_PROCESSOR_URL ?? "http://127.0.0.1:8080";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required (multipart)" }, { status: 400 });
    }

    const documentId = (form.get("document_id") as string) ?? file.name.replace(/\.pdf$/i, "");

    // 1. Try Python doc-processor for parsing + chunking
    let chunks: Awaited<ReturnType<typeof parseViaPython>>;
    try {
      chunks = await parseViaPython(file, documentId);
    } catch {
      // Fallback: parse in Node with pdf-parse
      const buffer = Buffer.from(await file.arrayBuffer());
      chunks = await parseViaNode(buffer, file.name, documentId);
    }

    if (!chunks.length) {
      return NextResponse.json({ error: "No extractable text found." }, { status: 422 });
    }

    // 2. Embed + index
    const embedder = new OllamaEmbeddingClient();
    const vectorStore = makeVectorStore();
    const llm = makeLLM();
    const pipeline = new RagPipeline({ embedder, vectorStore, llm });

    // Delete any existing chunks for this document (re-index)
    await vectorStore.deleteByDocument(documentId);

    // Chunk if the Python service gave us pages (text) rather than already-chunked
    // The Python /process endpoint returns chunks already. If we got raw pages, chunk here.
    // For simplicity, the Python /process returns chunks, but /parse returns pages.
    // This route uses the aggregated /process approach.
    await pipeline.index(chunks);

    return NextResponse.json({
      document_id: documentId,
      title: file.name,
      page_count: 0,
      chunk_count: chunks.length,
      indexed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("/api/ingest error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Parse + chunk via Python FastAPI service. */
async function parseViaPython(
  file: File,
  documentId: string,
) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("document_id", documentId);

  const res = await fetch(`${PYTHON_URL}/process`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Python /process error (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.chunks ?? []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    document_id: String(c.document_id),
    title: String(c.title),
    page: Number(c.page),
    section: String(c.section),
    text: String(c.text),
    char_count: Number(c.char_count),
    images: (c.images as string[]) ?? [],
  }));
}

/** Fallback: parse PDF in Node (simpler — just text extraction, no section). */
async function parseViaNode(
  buffer: Buffer,
  filename: string,
  documentId: string,
) {
  const pdfParse = (await import("pdf-parse")).default ?? (await import("pdf-parse"));
  const data: { text: string } = await pdfParse(buffer);

  const text = data.text ?? "";
  const lines = text.split(/\n\n+/).filter(Boolean);

  return lines.map((body: string, i: number) => ({
    id: `${documentId}-node-${i}`,
    document_id: documentId,
    title: filename,
    page: i + 1,
    section: "",
    text: body,
    char_count: body.length,
    images: [],
  }));
}