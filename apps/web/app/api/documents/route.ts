/** DELETE /api/documents?id=<document_id> — remove one manual and its chunks/faults. */
import { NextRequest } from "next/server";
import { getStore } from "@/lib/rag-index";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id query param required" }, { status: 400 });

  const store = getStore();
  const existed = store.listDocuments().some((d) => d.documentId === id);
  if (!existed) return Response.json({ error: "document not found" }, { status: 404 });

  store.deleteDocument(id);
  store.save();
  return Response.json({ deleted: id });
}
