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

export function getEmbedder(): JinaEmbeddingClient {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "JINA_API_KEY is not set. Add it to apps/web/.env.local and restart the dev server.",
    );
  }
  return new JinaEmbeddingClient({ apiKey });
}

export { INDEX_PATH };
