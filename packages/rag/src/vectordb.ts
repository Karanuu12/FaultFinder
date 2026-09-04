/**
 * Qdrant vector store wrapper.
 * Uses @qdrant/js-client-rest to connect to Qdrant (cloud or local).
 */
import { QdrantClient } from "@qdrant/js-client-rest";
import type { Chunk, ScoredHit, VectorStore } from "./types";

export interface VectorDbConfig {
  url: string;
  apiKey?: string;
  /** Qdrant collection name. */
  collection?: string;
  /** Embedding dimension to verify on first use. */
  dims?: number;
}

export class QdrantStore implements VectorStore {
  private client: QdrantClient;
  private collection: string;
  private dims: number;
  private ready = false;

  constructor(config: VectorDbConfig) {
    this.client = new QdrantClient({
      url: config.url,
      apiKey: config.apiKey,
    });
    this.collection = config.collection ?? "timmo_rag";
    this.dims = config.dims ?? 768;
  }

  /** Ensure collection exists (lazy). */
  async ensure(): Promise<void> {
    if (this.ready) return;
    const exists = await this.client.collectionExists(this.collection);
    if (!exists.exists) {
      await this.client.createCollection(this.collection, {
        vectors: { size: this.dims, distance: "Cosine" },
      });
    }
    this.ready = true;
  }

  /** Index chunks with their embeddings. */
  async index(chunks: Chunk[], vectors: number[][]): Promise<void> {
    if (!chunks.length) return;
    await this.ensure();
    const points = chunks.map((c, i) => ({
      id: c.id,
      vector: vectors[i] ?? new Array(this.dims).fill(0),
      payload: {
        document_id: c.document_id,
        title: c.title,
        page: c.page,
        section: c.section,
        text: c.text,
        char_count: c.char_count,
      },
    }));
    await this.client.upsert(this.collection, {
      wait: true,
      points,
    });
  }

  /** Query the collection; returns scored hits. */
  async query(vector: number[], topK = 10, filter?: Record<string, unknown>): Promise<ScoredHit[]> {
    await this.ensure();
    const results = await this.client.query(this.collection, {
      query: vector,
      limit: topK,
      with_payload: true,
      filter: filter ?? {},
    });
    return results.points.map((p) => ({
      id: String(p.id),
      document_id: (p.payload as Record<string, unknown>).document_id as string ?? "",
      title: (p.payload as Record<string, unknown>).title as string ?? "",
      page: (p.payload as Record<string, unknown>).page as number ?? 0,
      section: (p.payload as Record<string, unknown>).section as string ?? "",
      text: (p.payload as Record<string, unknown>).text as string ?? "",
      char_count: (p.payload as Record<string, unknown>).char_count as number ?? 0,
      score: p.score ?? 0,
    }));
  }

  /** Delete chunks for a specific document (re-ingestion). */
  async deleteByDocument(documentId: string): Promise<void> {
    await this.ensure();
    await this.client.delete(this.collection, {
      filter: {
        must: [{ key: "document_id", match: { value: documentId } }],
      },
    });
  }
}

export { QdrantClient };