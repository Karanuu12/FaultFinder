/**
 * Jina embeddings client — hosted, free tier, multilingual.
 *
 * Replaces the local Ollama dependency. Three things it does that the Ollama
 * client did not:
 *
 *   1. Real batching. The old client fired one HTTP request per chunk
 *      (BATCH_SIZE was a concurrency fan-out, not a batch), so a 172-page
 *      manual meant thousands of round trips. Jina takes an array.
 *   2. Asymmetric retrieval. jina-embeddings-v3 has separate task types for
 *      documents and queries; using the right one materially improves recall.
 *   3. Rate-limit handling, because a free tier will 429 during a bulk ingest.
 *
 * Multilingual by default (89 languages), which is what makes the later
 * multilingual requirement mostly free.
 */
import { z } from "zod";

const JINA_URL = "https://api.jina.ai/v1/embeddings";

/**
 * Sliding-window token budget. Concurrency alone caused this: 4 batches x 64
 * chunks x ~400 tokens fire almost simultaneously (~100k+ tokens in one
 * instant), which blows a per-MINUTE token limit even though each request is
 * well-formed and none of them individually looks large. Workers must ask
 * before sending, not just be capped in count.
 */
class TokenRateLimiter {
  private readonly windowMs = 60_000;
  private log: { t: number; tokens: number }[] = [];

  constructor(private readonly limitPerMinute: number) {}

  private used(now: number): number {
    this.log = this.log.filter((e) => now - e.t < this.windowMs);
    return this.log.reduce((s, e) => s + e.tokens, 0);
  }

  async acquire(tokens: number): Promise<void> {
    // A single batch bigger than the entire per-minute budget can NEVER
    // satisfy `used + tokens <= limit` -- waiting for it to fit is an
    // infinite loop (an upload that hangs forever, never erroring). Clamp
    // the reservation: let it through once the window is otherwise clear and
    // let the 429 retry path handle it, rather than deadlock.
    const request = Math.min(tokens, this.limitPerMinute);
    for (;;) {
      const now = Date.now();
      if (this.used(now) + request <= this.limitPerMinute) {
        this.log.push({ t: now, tokens: request });
        return;
      }
      const oldest = this.log[0];
      const wait = oldest ? this.windowMs - (now - oldest.t) + 100 : 1000;
      await new Promise((r) => setTimeout(r, Math.min(Math.max(wait, 200), 5000)));
    }
  }
}

/**
 * The token budget is an ACCOUNT-wide limit, so the limiter has to be too.
 * getEmbedder() builds a fresh client per request, so a per-instance limiter
 * hands every concurrent upload (or upload + chat query) its own full budget
 * -- two at once then legitimately exceed the real limit and 429, which is
 * exactly the "two different files, same error" report.
 */
const sharedLimiters = new Map<number, TokenRateLimiter>();
function limiterFor(limitPerMinute: number): TokenRateLimiter {
  let limiter = sharedLimiters.get(limitPerMinute);
  if (!limiter) {
    limiter = new TokenRateLimiter(limitPerMinute);
    sharedLimiters.set(limitPerMinute, limiter);
  }
  return limiter;
}

/** ~4 chars/token for English technical text -- same ratio the chunker uses for consistency. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.6);
}

const RESPONSE = z.object({
  data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })),
  usage: z.object({ total_tokens: z.number() }).optional(),
});

export interface JinaConfig {
  apiKey: string;
  model?: string;
  /** Output dimension. v3 supports Matryoshka truncation: 1024 (default), 768, 512, 256. */
  dimensions?: number;
  /** Texts per request. Jina accepts large arrays; this keeps payloads sane. */
  batchSize?: number;
  /** Batches in flight at once. Independent HTTP calls, not related to dims/model. */
  concurrency?: number;
  /** Free-tier default is 100k; kept below that so this client backs off before Jina 429s it. */
  tokensPerMinute?: number;
  baseUrl?: string;
}

export const JINA_DEFAULT_DIMS = 1024;

export class JinaEmbeddingClient {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private batchSize: number;
  private concurrency: number;
  private baseUrl: string;
  private limiter: TokenRateLimiter;

  constructor(config: JinaConfig) {
    if (!config.apiKey) throw new Error("JINA_API_KEY is required for JinaEmbeddingClient");
    this.apiKey = config.apiKey;
    this.model = config.model ?? "jina-embeddings-v3";
    this.dimensions = config.dimensions ?? JINA_DEFAULT_DIMS;
    this.batchSize = config.batchSize ?? 64;
    this.concurrency = config.concurrency ?? 4;
    this.baseUrl = config.baseUrl ?? JINA_URL;
    this.limiter = limiterFor(config.tokensPerMinute ?? 85_000);
  }

  get dims(): number {
    return this.dimensions;
  }

  /** Embed documents for indexing. */
  async embedMany(inputs: string[], onProgress?: (done: number, total: number) => void): Promise<number[][]> {
    return this.embedBatched(inputs, "retrieval.passage", onProgress);
  }

  /** Alias kept so this is a drop-in for the old OllamaEmbeddingClient. */
  embed(inputs: string[]): Promise<number[][]> {
    return this.embedMany(inputs);
  }

  /** Embed a search query. Uses the query task type, not the passage one. */
  async embedQuery(query: string): Promise<number[]> {
    const [v] = await this.embedBatched([query], "retrieval.query");
    return v;
  }

  /**
   * Batches ran fully sequentially before -- one Jina round-trip at a time,
   * each retry (up to ~46s worst case) blocking every batch after it. On a
   * large manual (hundreds of chunks, a dozen-plus batches) that serializes
   * into multi-minute ingests, worse under rate limiting since retries stack
   * instead of overlapping. Bounded concurrency fixes both: independent
   * batches run in parallel, and a rate-limited one no longer blocks the rest.
   */
  private async embedBatched(
    inputs: string[],
    task: "retrieval.passage" | "retrieval.query",
    onProgress?: (done: number, total: number) => void,
  ): Promise<number[][]> {
    if (!inputs?.length) return [];

    const out: number[][] = new Array(inputs.length);
    const chunks: { start: number; batch: string[] }[] = [];
    for (let i = 0; i < inputs.length; i += this.batchSize) {
      chunks.push({ start: i, batch: inputs.slice(i, i + this.batchSize) });
    }

    let doneCount = 0;
    let nextChunk = 0;
    const worker = async () => {
      while (nextChunk < chunks.length) {
        const { start, batch } = chunks[nextChunk++];
        // Concurrency controls how many requests can be IN FLIGHT; the
        // limiter controls how many TOKENS leave in a given minute -- the
        // actual thing Jina's free tier caps. Without this, 4 concurrent
        // batches can fire ~100k+ tokens in the same instant and 429
        // immediately, no matter how well-behaved each individual request is.
        const tokens = batch.reduce((s, t) => s + estimateTokens(t), 0);
        await this.limiter.acquire(tokens);
        const vectors = await this.postWithRetry(batch, task);
        for (let j = 0; j < vectors.length; j++) out[start + j] = vectors[j];
        doneCount += batch.length;
        onProgress?.(Math.min(doneCount, inputs.length), inputs.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, chunks.length) }, worker));
    return out;
  }

  /**
   * One request, retrying on 429/5xx with exponential backoff.
   * Jina's free tier rate-limits per minute, so a bulk ingest WILL hit this.
   */
  private async postWithRetry(
    batch: string[],
    task: string,
    attempt = 0,
  ): Promise<number[][]> {
    // Jina rejects empty strings; substitute a single space and let the vector be near-noise.
    const input = batch.map((t) => (t.trim().length ? t : " "));

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        task,
        dimensions: this.dimensions,
        input,
      }),
    });

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 4) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Jina embed failed after retries (${res.status}): ${detail.slice(0, 300)}`);
      }
      const waitMs = Math.min(30_000, 1500 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, waitMs));
      return this.postWithRetry(batch, task, attempt + 1);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Jina embed failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const parsed = RESPONSE.parse(await res.json());
    // The API may return results out of order; index is authoritative.
    const vectors: number[][] = new Array(batch.length);
    for (const d of parsed.data) vectors[d.index] = d.embedding;
    return vectors;
  }
}
