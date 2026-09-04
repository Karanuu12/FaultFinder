/**
 * GET /api/stats — live index numbers.
 * Replaces the hardcoded "5 files / 81 chunks / 768 dims" cards on the chat page.
 */
import { getStore } from "@/lib/rag-index";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = getStore();
    return Response.json({
      ...store.stats,
      documents_list: store.listDocuments().map((d) => ({
        document_id: d.documentId,
        title: d.title,
        machine_id: d.machineId,
        model: d.model,
        pages: d.pageCount,
        chunks: d.chunkCount,
        faults: d.faultCount,
        indexed_at: d.indexedAt,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
