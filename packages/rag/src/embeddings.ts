/** Gemini embeddings client (hosted, free tier) using plain fetch. */
import { z } from "zod";

export interface EmbeddingConfig {
  apiKey: string;
  /** Gemini embedding model. */
  model?: string;
  /** Optional task type for retrieval/query (Gemini guides embedding quality). */
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY" | "CLASSIFICATION";
}

const EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent";

const EMBED_RESPONSE = z.object({
  embedding: z.object({
    values: z.array(z.number()),
  }),
});

/** How many inputs the model accepts per request; we batch under this. */
export const BATCH_SIZE = 96;

export class GeminiEmbeddingClient {
  private apiKey: string;
  private model: string;
  private taskType: string;

  constructor(config: EmbeddingConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "text-embedding-004";
    this.taskType = config.taskType ?? "RETRIEVAL_DOCUMENT";
  }

  /** Embed a batch of strings; returns one vector per input, in order. */
  async embed(inputs: string[]): Promise<number[][]> {
    if (!inputs?.length) return [];
    const vectors: number[][] = [];
    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      const batch = inputs.slice(i, i + BATCH_SIZE);
      vectors.push(...await this.embedBatch(batch));
    }
    return vectors;
  }

  embedMany(inputs: string[]): Promise<number[][]> {
    return this.embed(inputs);
  }

  /** Single-string convenience for a query. */
  async embedQuery(query: string): Promise<number[]> {
    const vectors = await this.embedBatch([query], "RETRIEVAL_QUERY");
    return vectors[0];
  }

  private async embedBatch(inputs: string[], taskTypeOverride?: string): Promise<number[][]> {
    const url = EMBED_URL.replace("{model}", this.model);
    const body = {
      model: this.model,
      content: { parts: [{ text: inputs.join("\n\n") }] },
      taskType: taskTypeOverride ?? this.taskType,
      title: "timmo-rag",
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gemini embed failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const raw = await res.json();
    const parsed = EMBED_RESPONSE.parse(raw);
    return [parsed.embedding.values];
  }
}

export type { z };