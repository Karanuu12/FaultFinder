/**
 * In-memory ingest progress, keyed by a job id the client generates.
 *
 * The upload bar was previously simulated: it ticked to 95% and parked there
 * for however long the server actually took (73s on a 172-page manual, minutes
 * on a 460-page one), which reads as "stuck" even when everything is fine.
 * The embedder already reports real batch progress via onProgress; this is
 * just somewhere to put it that the client can poll.
 *
 * Deliberately in-memory: progress is throwaway, per-process state. It dies
 * with the process, which is correct -- a job whose server restarted is not
 * in progress anymore.
 */
export type IngestStage = "parsing" | "chunking" | "embedding" | "indexing" | "done" | "error";

export interface IngestProgress {
  stage: IngestStage;
  /** 0-100, real -- not simulated. */
  pct: number;
  detail?: string;
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __faultfinderProgress: Map<string, IngestProgress> | undefined;
}

function store(): Map<string, IngestProgress> {
  if (!globalThis.__faultfinderProgress) globalThis.__faultfinderProgress = new Map();
  return globalThis.__faultfinderProgress;
}

export function setProgress(jobId: string, stage: IngestStage, pct: number, detail?: string): void {
  if (!jobId) return;
  store().set(jobId, { stage, pct: Math.max(0, Math.min(100, Math.round(pct))), detail, updatedAt: Date.now() });
  pruneStale();
}

export function getProgress(jobId: string): IngestProgress | undefined {
  return store().get(jobId);
}

/** Drop entries older than 30 min so a long-lived dev server doesn't accumulate them. */
function pruneStale(): void {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, p] of store()) {
    if (p.updatedAt < cutoff) store().delete(id);
  }
}
