import type {
  ChatRequest,
  ChatResult,
  Chunk,
  ScoredHit,
  StreamEvent,
  VectorStore,
} from "./types";
import { OllamaEmbeddingClient } from "./embeddings";
import {
  expandQuery,
  gateByScore,
  detectMachineScope,
  dedupeHits,
  exactMatchHits,
  DEFAULT_MIN_SCORE,
} from "./retrieval";
import type { GroqClient } from "./llm";

export interface PipelineConfig {
  embedder: OllamaEmbeddingClient;
  vectorStore: VectorStore;
  llm: GroqClient;
}

export class RagPipeline {
  private embedder: OllamaEmbeddingClient;
  private vectorStore: VectorStore;
  private llm: GroqClient;

  constructor(config: PipelineConfig) {
    this.embedder = config.embedder;
    this.vectorStore = config.vectorStore;
    this.llm = config.llm;
  }

  async index(chunks: Chunk[]): Promise<void> {
    const texts = chunks.map((c) => c.text);
    const vectors = await this.embedder.embedMany(texts);
    await this.vectorStore.index(chunks, vectors);
  }

  /** Retrieve vector hits with high topK to get a full candidate pool for exact matching. */
  private async retrieve(queryVector: number[], topK: number): Promise<ScoredHit[]> {
    return this.vectorStore.query(queryVector, topK);
  }

  /** Combine vector + exact matches, dedup, scope-filter. */
  private refineHits(
    allVecHits: ScoredHit[],
    query: string,
    machineScope?: string,
  ): { pool: ScoredHit[] } {
    const deduped = dedupeHits(allVecHits);

    // Exact-match pre-retrieval on the full pool
    const exactHits = exactMatchHits(query, deduped);

    // Merge: exact matches (score 1.0) + remaining vector hits, dedup
    const merged = [...exactHits, ...deduped];
    const seen = new Set<string>();
    const pool: ScoredHit[] = [];
    for (const h of merged) {
      const key = `${h.document_id}:${h.page}:${h.section}`;
      if (!seen.has(key)) {
        seen.add(key);
        pool.push(h);
      }
    }

    // Machine scope filter
    const scoped = machineScope
      ? pool.filter((h) =>
          h.document_id.toLowerCase().includes(machineScope.toLowerCase().replace(/-/g, "")),
        )
      : pool;

    return { pool: scoped.length ? scoped : pool };
  }

  async query(req: ChatRequest): Promise<ChatResult> {
    const queries = expandQuery(req.message);
    const machineScope = req.machine ?? detectMachineScope(req.message);
    const topK = Math.max(req.top_k ?? 50, 100); // large enough to act as "all"

    const queryVector = await this.embedder.embedQuery(queries.join("\n"));
    const allHits = await this.retrieve(queryVector, topK);
    const { pool } = this.refineHits(allHits, req.message, machineScope);

    const minScore = req.min_score ?? DEFAULT_MIN_SCORE;
    const slice = pool.slice(0, 12);
    const { accepted, refusals } = gateByScore(slice, minScore);

    if (accepted.length === 0) {
      return {
        answer: {
          meaning: refusals[0] ?? "No matching content found.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals,
        },
        sources: [],
      };
    }

    const answer = await this.llm.generateAnswer(
      req.message,
      accepted,
      req.history ?? [],
      machineScope,
    );

    // Attach images from source chunks
    const sourceImages = accepted.flatMap((s) => s.images ?? []).filter(Boolean);
    const uniqueImages = [...new Set(sourceImages)].slice(0, 6);

    return { answer: { ...answer, images: uniqueImages }, sources: accepted };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const queries = expandQuery(req.message);
    const machineScope = req.machine ?? detectMachineScope(req.message);
    const topK = Math.max(req.top_k ?? 50, 100);

    const queryVector = await this.embedder.embedQuery(queries.join("\n"));
    const allHits = await this.retrieve(queryVector, topK);
    const { pool } = this.refineHits(allHits, req.message, machineScope);

    yield { type: "context", document: machineScope ?? "any", chunks: pool };

    const minScore = req.min_score ?? DEFAULT_MIN_SCORE;
    const slice = pool.slice(0, 12);
    const { accepted, refusals } = gateByScore(slice, minScore);

    if (accepted.length === 0) {
      yield {
        type: "answer",
        answer: {
          meaning: refusals[0] ?? "No matching content found.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals,
        },
      };
      yield { type: "done" };
      return;
    }

    yield { type: "sources", sources: accepted };

    const answer = await this.llm.generateAnswer(
      req.message, accepted, req.history ?? [], machineScope,
    );

    const sourceImages = [...new Set(accepted.flatMap((s) => s.images ?? []))].slice(0, 6);
    yield { type: "answer", answer: { ...answer, images: sourceImages } };
    yield { type: "done", answer: { ...answer, images: sourceImages } };
  }
}