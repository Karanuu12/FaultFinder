/**
 * Full RAG pipeline orchestrator.
 * 1. Embed the query → 2. Retrieve from Qdrant → 3. Gate/refine → 4. Generate answer.
 */
import type {
  ChatRequest,
  ChatResult,
  Chunk,
  ScoredHit,
  CitedAnswer,
  StreamEvent,
  VectorStore,
} from "./types";
import { GeminiEmbeddingClient } from "./embeddings";
import {
  expandQuery,
  gateByScore,
  detectMachineScope,
  dedupeHits,
  DEFAULT_MIN_SCORE,
} from "./retrieval";
import type { GroqClient } from "./llm";

export interface PipelineConfig {
  embedder: GeminiEmbeddingClient;
  vectorStore: VectorStore;
  llm: GroqClient;
}

export class RagPipeline {
  private embedder: GeminiEmbeddingClient;
  private vectorStore: VectorStore;
  private llm: GroqClient;

  constructor(config: PipelineConfig) {
    this.embedder = config.embedder;
    this.vectorStore = config.vectorStore;
    this.llm = config.llm;
  }

  /** Index a set of chunks with their embeddings. */
  async index(chunks: Chunk[]): Promise<void> {
    const texts = chunks.map((c) => c.text);
    const vectors = await this.embedder.embedMany(texts);
    await this.vectorStore.index(chunks, vectors);
  }

  /** Full RAG round-trip: query → retrieve → answer. */
  async query(req: ChatRequest): Promise<ChatResult> {
    const queries = expandQuery(req.message);
    const machineScope = req.machine ?? detectMachineScope(req.message);

    // Query embedding
    const queryVector = await this.embedder.embedQuery(queries.join("\n"));

    // Retrieve hits
    const topK = req.top_k ?? 10;
    const allHits = await this.vectorStore.query(queryVector, topK);
    const deduped = dedupeHits(allHits);

    // Per-machine filter if scope detected
    const scopedHits = machineScope
      ? deduped.filter((h) =>
          h.document_id.toLowerCase().includes(machineScope.toLowerCase().replace(/-/g, ""))
        )
      : deduped;

    const fallbackHits = scopedHits.length ? scopedHits : deduped;

    // Hallucination gate
    const minScore = req.min_score ?? DEFAULT_MIN_SCORE;
    const { accepted, refusals } = gateByScore(
      fallbackHits.length ? fallbackHits.slice(0, 6) : deduped.slice(0, 6),
      minScore,
    );

    // If all rejected, return graceful refusal
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

    // Generate LLM answer from accepted context
    const answer = await this.llm.generateAnswer(
      req.message,
      accepted,
      req.history ?? [],
      machineScope,
    );

    return { answer, sources: accepted };
  }

  /** Streaming version: yields structured events as they happen. */
  async *stream(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const queries = expandQuery(req.message);
    const machineScope = req.machine ?? detectMachineScope(req.message);

    const queryVector = await this.embedder.embedQuery(queries.join("\n"));

    const topK = req.top_k ?? 10;
    const allHits = await this.vectorStore.query(queryVector, topK);
    const deduped = dedupeHits(allHits);

    const scopedHits = machineScope
      ? deduped.filter((h) =>
          h.document_id.toLowerCase().includes(machineScope.toLowerCase().replace(/-/g, ""))
        )
      : deduped;

    const fallbackHits = scopedHits.length ? scopedHits : deduped;
    const minScore = req.min_score ?? DEFAULT_MIN_SCORE;
    const { accepted, refusals } = gateByScore(
      fallbackHits.length ? fallbackHits.slice(0, 6) : deduped.slice(0, 6),
      minScore,
    );

    yield { type: "context", document: machineScope ?? "any", chunks: fallbackHits };

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

    yield { type: "answer", answer };
    yield { type: "done", answer };
  }
}