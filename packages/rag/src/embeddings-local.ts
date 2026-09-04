/**
 * Local embeddings via the doc-processor's /embed endpoint
 * (jina-embeddings-v5-omni-small-retrieval, run in-process there).
 *
 * Deliberately a drop-in for JinaEmbeddingClient -- same embedMany/embedQuery
 * shape -- so getEmbedder() can switch between them with one env var and
 * nothing downstream changes.
 *
 * What's different from the API client, and why this branch exists:
 *   - No token-rate limiter. There's no quota to respect, so the whole
 *     budget/backoff machinery that caused the stuck-at-95% pauses is gone.
 *   - No API key.
 *   - Batches are still bounded, but for memory (a 1.74B model on an 8GB card)
 *     rather than for a rate limit.
 */

export interface LocalEmbeddingConfig {
  /** Doc-processor base URL; same service that parses PDFs. */
  baseUrl?: string;
  /** Texts per request. Bounded by GPU memory, not by any quota. */
  batchSize?: number;
  dimensions?: number;
}

export const LOCAL_DEFAULT_DIMS = 1024;

export class LocalEmbeddingClient {
  private baseUrl: string;
  private batchSize: number;
  private dimensions: number;

  constructor(config: LocalEmbeddingConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.DOC_PROCESSOR_URL ?? "http://127.0.0.1:8080";
    this.batchSize = config.batchSize ?? 32;
    this.dimensions = config.dimensions ?? LOCAL_DEFAULT_DIMS;
  }

  get dims(): number {
    return this.dimensions;
  }

  async embedMany(
    inputs: string[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<number[][]> {
    return this.embedBatched(inputs, "retrieval.passage", onProgress);
  }

  embed(inputs: string[]): Promise<number[][]> {
    return this.embedMany(inputs);
  }

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
    // Sequential on purpose: the bottleneck is one GPU, so firing batches
    // concurrently just queues them behind each other with extra memory
    // pressure. (The API client parallelizes because there the bottleneck is
    // network round-trips, not a single device.)
    for (let i = 0; i < inputs.length; i += this.batchSize) {
      const batch = inputs.slice(i, i + this.batchSize);
      const vectors = await this.post(batch, task);
      for (let j = 0; j < vectors.length; j++) out[i + j] = vectors[j];
      onProgress?.(Math.min(i + batch.length, inputs.length), inputs.length);
    }
    return out;
  }

  private async post(
    texts: string[],
    task: string,
  ): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: texts.map((t) => (t.trim().length ? t : " ")), task }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Local embed failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as { vectors: number[][]; dims: number };
    if (data.dims && data.dims !== this.dimensions) this.dimensions = data.dims;
    return data.vectors;
  }
}
