/**
 * POST /api/ingest — upload a PDF manual and index it.
 *
 * Flow:  PDF → parser → typed blocks → structure-aware chunks
 *                                   → fault records (code/meaning/cause/action)
 *                                   → Jina embeddings → local index
 *
 * The parser is currently the local FastAPI doc-processor. It is isolated behind
 * `parseDocument()` so swapping in LlamaParse (which returns markdown tables,
 * and therefore lights up the fault-table extractor) is a change to one function.
 */
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";

import { buildBlocks } from "@timmo/rag/doc/blocks";
import { chunkBlocks } from "@timmo/rag/doc/chunker";
import { extractFaultRecords } from "@timmo/rag/doc/faults";
import type { PageInput, OutlineInput } from "@timmo/rag/doc/blocks";
import { getStore, getEmbedder } from "@/lib/rag-index";

export const runtime = "nodejs";
// A 170-page manual takes minutes to parse + embed; don't let the platform cut it off.
export const maxDuration = 800;

const PYTHON_URL = process.env.DOC_PROCESSOR_URL ?? "http://127.0.0.1:8080";

/** Known machines, so chunks can be filtered by machine rather than by filename substring. */
const MACHINE_RULES: { id: string; model: string; manufacturer: string; test: RegExp }[] = [
  { id: "abb-acs150", model: "ACS150", manufacturer: "ABB", test: /acs\s*-?150/i },
  { id: "abb-acs350", model: "ACS350", manufacturer: "ABB", test: /acs\s*-?350/i },
  { id: "abb-irb4600", model: "IRB 4600", manufacturer: "ABB", test: /irb\s*-?4600|3hac033453/i },
  { id: "schneider-atv320", model: "ATV320", manufacturer: "Schneider", test: /atv\s*-?320/i },
  { id: "schneider-atv28", model: "ATV28", manufacturer: "Schneider", test: /atv\s*-?28/i },
  { id: "roboinject-300", model: "RoboInject-300", manufacturer: "Synthetic", test: /roboinject/i },
  { id: "press-2000", model: "Press-2000", manufacturer: "Synthetic", test: /press-?2000/i },
  { id: "press-2001", model: "Press-2001", manufacturer: "Synthetic", test: /press-?2001/i },
  { id: "powerflex-525", model: "PowerFlex-525", manufacturer: "Rockwell", test: /powerflex/i },
];

function detectMachine(filename: string, firstPages: string) {
  const haystack = `${filename}\n${firstPages.slice(0, 4000)}`;
  for (const rule of MACHINE_RULES) {
    if (rule.test.test(haystack)) return rule;
  }
  const slug = filename
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return { id: slug || "unknown", model: filename.replace(/\.pdf$/i, ""), manufacturer: "", test: /$^/ };
}

/** Parser adapter. Swap the body for LlamaParse when the key is available. */
async function parseDocument(
  file: File,
  documentId: string,
): Promise<{ title: string; pages: PageInput[]; outline: OutlineInput[] }> {
  const form = new FormData();
  form.set("file", file);
  form.set("document_id", documentId);
  // Extract embedded diagrams/figures so they can be shown in cited answers.
  // Capped at 3 per page, <=500KB each, pre-filtered by size before decoding
  // (services/document-processor/app/pdf.py) so this stays reasonable even on
  // a 300+ page manual.
  form.set("include_images", "true");

  const res = await fetch(`${PYTHON_URL}/parse`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Parser failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const pages: PageInput[] = (data.pages ?? []).map((p: Record<string, unknown>) => ({
    page: Number(p.page),
    text: String(p.text ?? ""),
    images: Array.isArray(p.images) ? (p.images as string[]) : [],
  }));
  // The PDF's own bookmark tree — exact section titles and pages. Preferred over
  // inferring headings from the text, which produced section labels like
  // "4 = 380…480 V AC" on ABB manuals.
  const outline: OutlineInput[] = (data.outline ?? []).map((o: Record<string, unknown>) => ({
    title: String(o.title ?? ""),
    pagePdf: Number(o.page_pdf ?? 0),
    level: Number(o.level ?? 0),
  }));
  return { title: String(data.title ?? file.name), pages, outline };
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "file is required (multipart form field 'file')" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const documentId =
      (form.get("document_id") as string) || file.name.replace(/\.pdf$/i, "").replace(/\s+/g, "-");

    // 1. Parse
    const { title, pages, outline } = await parseDocument(file, documentId);
    if (!pages.length) {
      return Response.json({ error: "No extractable text found in the PDF." }, { status: 422 });
    }

    // 2. Identify the machine so retrieval can filter on it
    const machine = detectMachine(file.name, pages.slice(0, 3).map((p) => p.text).join("\n"));

    // 3. Blocks → chunks → fault records
    const blocks = buildBlocks(pages, { documentId, outline });
    const chunks = chunkBlocks(blocks, {
      machineId: machine.id,
      machineLabel: machine.model,
      model: machine.model,
      documentTitle: title,
    });
    const faults = extractFaultRecords(blocks, {
      machineId: machine.id,
      model: machine.model,
      documentTitle: title,
    });

    if (!chunks.length) {
      return Response.json({ error: "Parsed the PDF but produced no chunks." }, { status: 422 });
    }

    // 4. Embed (batched — one request per 64 chunks, not one per chunk)
    const embedder = getEmbedder();
    const vectors = await embedder.embedMany(chunks.map((c) => c.text));

    // 5. Index
    const store = getStore();
    store.addDocument(
      {
        documentId,
        title,
        machineId: machine.id,
        model: machine.model,
        pageCount: pages.length,
        chunkCount: chunks.length,
        faultCount: faults.length,
        sha256,
        indexedAt: new Date().toISOString(),
      },
      chunks,
      vectors,
      faults,
    );

    return Response.json({
      document_id: documentId,
      title,
      machine_id: machine.id,
      model: machine.model,
      pages: pages.length,
      chunks: chunks.length,
      faults: faults.length,
      fault_codes: [...new Set(faults.map((f) => f.codeRaw))].slice(0, 40),
      dims: vectors[0]?.length ?? 0,
      elapsed_ms: Date.now() - started,
      indexed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("/api/ingest error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message, elapsed_ms: Date.now() - started }, { status: 500 });
  }
}
