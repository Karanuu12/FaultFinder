import { QdrantStore, MemoryVectorStore } from "@timmo/rag";
import type { VectorStore } from "@timmo/rag";

export function makeVectorStore(): VectorStore {
  const url = process.env.QDRANT_CLUSTER_ENDPOINT ?? process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (url) {
    console.log("Using Qdrant vector store at", url);
    return new QdrantStore({ url, apiKey, dims: 768 });
  }

  console.log("Using in-memory vector store (no QDRANT_URL/QDRANT_CLUSTER_ENDPOINT set)");
  return new MemoryVectorStore();
}

export type { VectorStore };