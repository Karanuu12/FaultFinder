/** Ollama embeddings client — calls local Ollama server for lightweight, free embeddings. */
import { z } from "zod";

export interface EmbeddingConfig {
  baseUrl?: string;
  model?: string;
}

const OLLAMA_EMBED_RESPONSE = z.object({
  embedding: z.array(z.number()),
});

export const BATCH_SIZE = 96;

export class OllamaEmbeddingClient {
  private baseUrl: string;
  private model: string;

  constructor(config: EmbeddingConfig = {}) {
    this.baseUrl = config.baseUrl ?? "http://127.0.0.1:11434";
    this.model = config.model ?? "nomic-embed-text";
  }

  /** Embed all inputs, returns one vector per input in order. */
  async embed(inputs: string[]): Promise<number[][]> {
    if (!inputs?.length) return [];
    const vectors: number[][] = [];
    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      const batch = inputs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((text) => this.embedOne(text)));
      vectors.push(...results);
    }
    return vectors;
  }

  embedMany(inputs: string[]): Promise<number[][]> {
    return this.embed(inputs);
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.embedOne(query);
  }

  private async embedOne(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Ollama embed failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const raw = await res.json();
    const parsed = OLLAMA_EMBED_RESPONSE.parse(raw);
    return parsed.embedding;
  }
}

export { OllamaEmbeddingClient as EmbeddingClient };