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
import {
  runHallucinationControl,
  scoreGate,
  detectMachineAmbiguity,
  DEFAULT_MIN_SCORE,
} from "./hallucination-control";
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
          h.document_id.toLowerCase().includes(machineScope.toLowerCase().replace(/-/g, "")),
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

    // Stage 1: Machine ambiguity detection (pre-generation)
    const ambiguity = detectMachineAmbiguity(req.message, pool);
    if (ambiguity.ambiguous) {
      return {
        answer: {
          meaning: ambiguity.question,
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals: [ambiguity.question],
        },
        sources: [],
      };
    }

    // Stage 2: Score gate
    const minScore = req.min_score ?? DEFAULT_MIN_SCORE;
    const slice = pool.slice(0, 12);
    const { accepted, refusals: scoreRefusals } = scoreGate(slice, minScore);

    if (accepted.length === 0) {
      return {
        answer: {
          meaning: scoreRefusals[0] ?? "No matching content found.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals: scoreRefusals,
        },
        sources: [],
      };
    }

    // Generate LLM answer
    const answer = await this.llm.generateAnswer(
      req.message,
      accepted,
      req.history ?? [],
      machineScope,
    );

    // Stage 3: Post-generation hallucination control
    const hcResult = await runHallucinationControl(
      req.message,
      pool,
      accepted,
      answer,
    );

    // Attach images from source chunks
    const sourceImages = [...new Set(accepted.flatMap((s) => s.images ?? []))].filter(Boolean).slice(0, 6);

    // Handle verdict
    if (hcResult.verdict === "reject") {
      return {
        answer: {
          meaning: "The answer did not pass the hallucination control checks.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          images: sourceImages,
          confidence: "low",
          refusals: hcResult.refusals.length > 0
            ? hcResult.refusals
            : ["The system's safety checks flagged this response. The answer has been suppressed."],
        },
        sources: accepted,
      };
    }

    return {
      answer: {
        ...answer,
        images: sourceImages,
        ...(hcResult.verdict === "flag" ? { confidence: "low" as const } : {}),
        refusals: hcResult.refusals,
      },
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

    const ambiguity = detectMachineAmbiguity(req.message, pool);
    if (ambiguity.ambiguous) {
      yield {
        type: "answer",
        answer: {
          meaning: ambiguity.question,
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals: [ambiguity.question],
        },
      };
      yield { type: "done" };
      return;
    }

    const minScore = req.min_score ?? DEFAULT_MIN_SCORE;
    const slice = pool.slice(0, 12);
    const { accepted, refusals: scoreRefusals } = scoreGate(slice, minScore);

    if (accepted.length === 0) {
      yield {
        type: "answer",
        answer: {
          meaning: scoreRefusals[0] ?? "No matching content found.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals: scoreRefusals,
        },
      };
      yield { type: "done" };
      return;
    }

    yield { type: "sources", sources: accepted };

    const answer = await this.llm.generateAnswer(
      req.message, accepted, req.history ?? [], machineScope,
    );

    const hcResult = await runHallucinationControl(
      req.message, pool, accepted, answer,
    );

    const sourceImages = [...new Set(accepted.flatMap((s) => s.images ?? []))].slice(0, 6);

    if (hcResult.verdict === "reject") {
      yield {
        type: "answer",
        answer: {
          meaning: "The answer did not pass the hallucination control checks.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          images: sourceImages,
          confidence: "low",
          refusals: hcResult.refusals.length > 0
            ? hcResult.refusals
            : ["The system's safety checks flagged this response."],
        },
      };
      yield { type: "done" };
      return;
    }

    yield {
      type: "answer",
      answer: {
        ...answer,
        images: sourceImages,
        ...(hcResult.verdict === "flag" ? { confidence: "low" as const } : {}),
        refusals: hcResult.refusals,
      },
    };
    yield { type: "done" };
  }
}