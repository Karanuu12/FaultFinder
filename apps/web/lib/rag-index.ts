/**
 * Process-wide singleton for the local index.
 *
 * The bug this fixes: makeVectorStore() was called *inside* each request
 * handler, so every request built a fresh empty MemoryVectorStore and nothing
 * ingested was ever findable. Stashing it on globalThis also survives Next's
 * hot reload, which otherwise drops the index on every file save.
 */
import { LocalStore } from "@timmo/rag/store/local-store";
import { JinaEmbeddingClient } from "@timmo/rag/embeddings-jina";
import { LocalEmbeddingClient } from "@timmo/rag/embeddings-local";
import path from "node:path";

const INDEX_PATH = path.resolve(process.cwd(), "../../.data/index.json");

declare global {
  // eslint-disable-next-line no-var
  var __faultfinderStore: LocalStore | undefined;
}

export function getStore(): LocalStore {
  if (!globalThis.__faultfinderStore) {
    globalThis.__faultfinderStore = new LocalStore(INDEX_PATH);
  }
  return globalThis.__faultfinderStore;
}

/** Anything with the embedMany/embedQuery shape -- API or local model. */
export type Embedder = JinaEmbeddingClient | LocalEmbeddingClient;

/**
 * EMBEDDINGS_PROVIDER=local runs jina-embeddings-v5-omni-small-retrieval in
 * the doc-processor (no key, no rate limit, no token budget). Anything else
 * uses the hosted Jina API.
 *
 * The two produce DIFFERENT vector spaces even at the same dimension count --
 * switching providers means the existing index is no longer comparable, so
 * re-upload the manuals after a switch.
 */
export function getEmbedder(): Embedder {
  if ((process.env.EMBEDDINGS_PROVIDER ?? "").toLowerCase() === "local") {
    return new LocalEmbeddingClient();
  }

  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "JINA_API_KEY is not set. Add it to apps/web/.env.local, or set EMBEDDINGS_PROVIDER=local to use the local model.",
    );
  }
  return new JinaEmbeddingClient({ apiKey });
}

export { INDEX_PATH };
