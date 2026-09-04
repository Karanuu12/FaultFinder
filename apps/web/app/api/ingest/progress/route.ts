/** GET /api/ingest/progress?id=<job_id> — real ingest progress for the upload bar. */
import { NextRequest } from "next/server";
import { getProgress } from "@/lib/ingest-progress";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id query param required" }, { status: 400 });
  const progress = getProgress(id);
  if (!progress) return Response.json({ stage: "unknown", pct: 0 });
  return Response.json(progress);
}
