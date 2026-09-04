import type {
  ChatRequest,
  ChatResult,
  Chunk,
  ScoredHit,
  StreamEvent,
  VectorStore,
  CitedAnswer,
} from "./types";
import { OllamaEmbeddingClient } from "./embeddings";
import {
  expandQuery,
  detectMachineScope,
  dedupeHits,
  exactMatchHits,
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

  private async retrieve(queryVector: number[], topK: number): Promise<ScoredHit[]> {
    return this.vectorStore.query(queryVector, topK);
  }

  private refineHits(
    allVecHits: ScoredHit[],
    query: string,
    machineScope?: string,
  ): { pool: ScoredHit[] } {
    const deduped = dedupeHits(allVecHits);
    const exactHits = exactMatchHits(query, deduped);
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
    const scoped = machineScope
      ? pool.filter((h) =>
          h.document_id.toLowerCase().replace(/-/g, "").includes(machineScope.toLowerCase().replace(/-/g, "")),
        )
      : pool;
    return { pool: scoped.length ? scoped : pool };
  }

  async query(req: ChatRequest): Promise<ChatResult> {
    const queries = expandQuery(req.message);
    const machineScope = req.machine ?? detectMachineScope(req.message);
    const topK = Math.max(req.top_k ?? 50, 100);

    const queryVector = await this.embedder.embedQuery(queries.join("\n"));
    const allHits = await this.retrieve(queryVector, topK);
    const { pool } = this.refineHits(allHits, req.message, machineScope);
    console.log("[QUERY]", req.message, "-> scope:", machineScope, "pool:", pool.length, "docs:", [...new Set(pool.map(h => h.document_id))]);

    const accepted = pool.slice(0, 8);

    if (accepted.length === 0) {
      return {
        answer: {
          meaning: "No matching content found in the loaded manuals.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals: ["No relevant content was found."],
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

    const sourceImages = [...new Set(accepted.flatMap((s) => s.images ?? []))].filter(Boolean).slice(0, 6);

    return {
      answer: { ...answer, images: sourceImages },
      sources: accepted,
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const queries = expandQuery(req.message);
    const machineScope = req.machine ?? detectMachineScope(req.message);
    const topK = Math.max(req.top_k ?? 50, 100);

    const queryVector = await this.embedder.embedQuery(queries.join("\n"));
    const allHits = await this.retrieve(queryVector, topK);
    const { pool } = this.refineHits(allHits, req.message, machineScope);

    yield { type: "context", document: machineScope ?? "any", chunks: pool };

    const accepted = pool.slice(0, 8);

    if (accepted.length === 0) {
      yield {
        type: "answer",
        answer: {
          meaning: "No matching content found.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals: ["No relevant content was found."],
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