/**
 * Seed script: parse, chunk, embed, and index all synthetic manuals.
 * Usage: pnpm seed
 *
 * Requires: GEMINI_API_KEY, QDRANT_CLUSTER_ENDPOINT, QDRANT_API_KEY (in .env.local)
 */
import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env.local from apps/web (where Next.js expects it)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../apps/web/.env.local") });

import fs from "fs";
import path from "path";
import { GeminiEmbeddingClient, QdrantStore, MemoryVectorStore } from "@timmo/rag";
import pdfParse from "pdf-parse";
import crypto from "crypto";

const MANUALS_DIR = path.resolve(__dirname, "..", "manuals");

// Qdrant requires UUID or integer point IDs; generate a deterministic UUID v5
function stringToUUID(input: string): string {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-a${hash.slice(15, 18)}-${hash.slice(18, 30)}`;
}

function pdfParseBuffer(buffer: Buffer) {
  const text = buffer.toString("utf-8").replace(/[^\x20-\x7E\n]/g, "").trim();
  // our synthetic PDFs use PyMuPDF -> we get actual readable text
  return { text, numpages: 1 };
}

async function main() {
  const files = fs.readdirSync(MANUALS_DIR).filter((f) => f.endsWith(".pdf"));
  if (!files.length) {
    console.error("No PDFs found in manuals/. Run: uv run scripts/generate_manuals.py");
    process.exit(1);
  }

  const embedder = new GeminiEmbeddingClient({
    apiKey: process.env.GEMINI_API_KEY ?? "",
  });

  const vectorStore = process.env.QDRANT_CLUSTER_ENDPOINT ?? process.env.QDRANT_URL
    ? new QdrantStore({
        url: process.env.QDRANT_CLUSTER_ENDPOINT ?? process.env.QDRANT_URL ?? "",
        apiKey: process.env.QDRANT_API_KEY,
        dims: 3072,
      })
    : new MemoryVectorStore();

  for (const file of files) {
    const documentId = file.replace(/\.pdf$/i, "");
    const filePath = path.join(MANUALS_DIR, file);
    const buffer = fs.readFileSync(filePath);

    console.log(`\nProcessing ${file}...`);

    // Parse via Python doc processor if available, else use pdf-parse
    let chunks: { id: string; document_id: string; title: string; page: number; section: string; text: string; char_count: number }[];
    try {
      chunks = await parseViaPython(buffer, file, documentId);
      console.log(`  Python service: ${chunks.length} chunks`);
    } catch {
      chunks = await parseViaNode(buffer, file, documentId);
      console.log(`  Node fallback: ${chunks.length} chunks`);
    }

    if (chunks.length === 0) {
      console.warn(`  No chunks for ${file}, skipping`);
      continue;
    }

    // Embed + index
    const texts = chunks.map((c) => c.text);
    const vectors = await embedder.embedMany(texts);
    // Convert string IDs to deterministic UUID v5 format for Qdrant compatibility
    const qdrantChunks = chunks.map((c) => ({
      ...c,
      id: stringToUUID(c.id),
    }));
    try { await vectorStore.deleteByDocument(documentId); } catch { /* first seed */ }
    await vectorStore.index(qdrantChunks, vectors);
    console.log(`  Indexed ${chunks.length} chunks for "${documentId}"`);
  }

  const count = vectorStore instanceof MemoryVectorStore ? vectorStore.count : "Qdrant";
  console.log(`\nDone. Total vectors indexed: ${count}`);
}

async function parseViaPython(
  buffer: Buffer,
  filename: string,
  documentId: string,
): Promise<any[]> {
  // Send buffer as a FormData file-like object to the Python service
  const blob = new Blob([buffer], { type: "application/pdf" });
  const formData = new FormData();
  formData.set("file", blob, filename);
  formData.set("document_id", documentId);

  const url = process.env.DOC_PROCESSOR_URL ?? "http://127.0.0.1:8080";
  const res = await fetch(`${url}/process`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Python /process returned ${res.status}`);
  const data = await res.json();
  return (data.chunks ?? []).map((c: any) => ({
    id: String(c.id),
    document_id: String(c.document_id),
    title: String(c.title),
    page: Number(c.page),
    section: String(c.section),
    text: String(c.text),
    char_count: Number(c.char_count),
    images: (c.images ?? []) as string[],
  }));
}

async function parseViaNode(
  buffer: Buffer,
  filename: string,
  documentId: string,
): Promise<any[]> {
  const data = await pdfParse(buffer);
  const text = data.text ?? "";
  return text
    .split(/\n\n+/)
    .filter((b: string) => b.trim().length > 20)
    .map((body: string, i: number) => ({
      id: `${documentId}-${i}`,
      document_id: documentId,
      title: filename,
      page: i + 1,
      section: "",
      text: body,
      char_count: body.length,
    }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});