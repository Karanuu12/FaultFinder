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
  baseUrl?: string;
}

export const JINA_DEFAULT_DIMS = 1024;

export class JinaEmbeddingClient {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private batchSize: number;
  private baseUrl: string;

  constructor(config: JinaConfig) {
    if (!config.apiKey) throw new Error("JINA_API_KEY is required for JinaEmbeddingClient");
    this.apiKey = config.apiKey;
    this.model = config.model ?? "jina-embeddings-v3";
    this.dimensions = config.dimensions ?? JINA_DEFAULT_DIMS;
    this.batchSize = config.batchSize ?? 64;
    this.baseUrl = config.baseUrl ?? JINA_URL;
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

  private async embedBatched(
    inputs: string[],
    task: "retrieval.passage" | "retrieval.query",
    onProgress?: (done: number, total: number) => void,
  ): Promise<number[][]> {
    if (!inputs?.length) return [];

    const out: number[][] = new Array(inputs.length);
    for (let i = 0; i < inputs.length; i += this.batchSize) {
      const batch = inputs.slice(i, i + this.batchSize);
      const vectors = await this.postWithRetry(batch, task);
      for (let j = 0; j < vectors.length; j++) out[i + j] = vectors[j];
      onProgress?.(Math.min(i + batch.length, inputs.length), inputs.length);
    }
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
