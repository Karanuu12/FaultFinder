/**
 * Retrieval layer: hybrid query expansion, cross-manual disambiguation,
 * score filtering, and re-ranking.
 */
import type { Chunk, ScoredHit } from "./types";

/**
 * Build a refined search query from the raw user message.
 * Expands error-code patterns so the vector search catches both "E101" and
 * "error 101" / "101 overheating" etc.
 */
export function expandQuery(raw: string): string[] {
  const queries = [raw];
  const codeMatch = raw.match(/\b([A-Z]+)(\s?)(\d{3,4})\b/);
  if (codeMatch) {
    const [, prefix, , num] = codeMatch;
    queries.push(`${prefix} ${num} ${prefix}${num}`);
  }
  if (raw.trim().length > 3) {
    queries.push(raw.trim());
  }
  return [...new Set(queries)];
}

/**
 * Detect whether the query mentions a specific machine model.
 * Returns the model name or null.
 */
export function detectMachineScope(query: string): string | undefined {
  const modelPatterns = [
    /\b(RoboInject-?300|RI-?300)\b/i,
    /\b(Press-?2000|P-?2000)\b/i,
    /\b(Press-?2001|P-?2001)\b/i,
    /\b(PowerFl[ei]x[\s-]?525|PF-?525|powerflex)\b/i,
  ];
  for (const pat of modelPatterns) {
    const m = query.match(pat);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * Exact-match pre-retrieval: scan all available chunks for query terms.
 * Injects matching chunks with score 1.0 so they bypass the score threshold.
 * This fixes exact-code / parameter-code queries that the vector search misses.
 */
export function exactMatchHits(query: string, allChunks: ScoredHit[]): ScoredHit[] {
  const terms = query.toLowerCase().match(/\b[a-z0-9][a-z0-9.-]{1,}\b/g) ?? [];
  if (terms.length === 0) return [];

  const seen = new Set<string>();
  const matches: ScoredHit[] = [];

  for (const chunk of allChunks) {
    const lower = chunk.text.toLowerCase();
    // Only match if the term appears as a token (not just substring of a word)
    const matched = terms.some((t) => {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
    });
    if (matched) {
      const key = `${chunk.document_id}:${chunk.page}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({ ...chunk, score: 1.0 });
      }
    }
  }

  return matches;
}

/**
 * Deduplicate similar hits, preferring those with the highest score per chunk.
 */
export function dedupeHits(hits: ScoredHit[]): ScoredHit[] {
  const seen = new Set<string>();
  const unique: ScoredHit[] = [];
  for (const h of hits.sort((a, b) => b.score - a.score)) {
    const key = `${h.document_id}:${h.page}:${h.section}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(h);
    }
  }
  return unique;
}