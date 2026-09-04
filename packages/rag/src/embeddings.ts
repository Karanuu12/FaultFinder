/** Gemini embeddings client (hosted, free tier) using plain fetch with retry. */
import { z } from "zod";

export interface EmbeddingConfig {
  apiKey: string;
  model?: string;
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY" | "CLASSIFICATION";
}

const SINGLE_EMBED_RESPONSE = z.object({
  embedding: z.object({ values: z.array(z.number()) }),
});

const BATCH_EMBED_RESPONSE = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()) })),
});

export const BATCH_SIZE = 96;

export class GeminiEmbeddingClient {
  private apiKey: string;
  private model: string;
  private taskType: string;

  constructor(config: EmbeddingConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gemini-embedding-2";
    this.taskType = config.taskType ?? "RETRIEVAL_DOCUMENT";
  }

  async embed(inputs: string[]): Promise<number[][]> {
    if (!inputs?.length) return [];
    const vectors: number[][] = [];
    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      const batch = inputs.slice(i, i + BATCH_SIZE);
      vectors.push(...(await this.embedBatch(batch)));
    }
    return vectors;
  }

  embedMany(inputs: string[]): Promise<number[][]> {
    return this.embed(inputs);
  }

  async embedQuery(query: string): Promise<number[]> {
    const vectors = await this.embedBatch([query], "RETRIEVAL_QUERY");
    return vectors[0];
  }

  private async call(url: string, body: unknown, maxRetries = 3): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      const detail = await res.text().catch(() => "");
      throw new Error(`Gemini embed failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    throw new Error("Gemini embed: max retries exceeded");
  }

  private async embedBatch(inputs: string[], taskTypeOverride?: string): Promise<number[][]> {
    if (inputs.length > 1) {
      return this.embedBatchContents(inputs, taskTypeOverride);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`;
    const body = {
      model: `models/${this.model}`,
      content: { parts: [{ text: inputs[0] }] },
      taskType: taskTypeOverride ?? this.taskType,
    };

    const res = await this.call(url, body);
    const raw = await res.json();
    const parsed = SINGLE_EMBED_RESPONSE.parse(raw);
    return [parsed.embedding.values];
  }

  private async embedBatchContents(inputs: string[], taskTypeOverride?: string): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents`;
    const requests = inputs.map((text) => ({
      model: `models/${this.model}`,
      content: { parts: [{ text }] },
      taskType: taskTypeOverride ?? this.taskType,
    }));

    const res = await this.call(url, { requests });
    const raw = await res.json();
    const parsed = BATCH_EMBED_RESPONSE.parse(raw);
    return parsed.embeddings.map((e) => e.values);
  }
}