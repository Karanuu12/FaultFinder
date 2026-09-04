/** Shared types for the Timmo RAG pipeline. */

/** A single parsed/sectioned page as produced by the Python document processor. */
export interface SourcePage {
  page: number;
  section: string;
  text: string;
}

/** A chunk with its provenance metadata (used by indexing + retrieval). */
export interface Chunk {
  id: string;
  document_id: string;
  title: string;
  page: number;
  section: string;
  text: string;
  char_count: number;
}

/** A retrieval hit (chunk + similarity score). */
export interface ScoredHit extends Chunk {
  score: number;
}

/** One step in the corrective-action / answer structure. */
export interface AnswerStep {
  step: number;
  action: string;
}

/** A source citation pointing back into a manual. */
export interface Citation {
  document_id: string;
  title: string;
  page: number;
  section: string;
}

/** Structured, cited answer from the pipeline. */
export interface CitedAnswer {
  error_code?: string;
  meaning: string;
  probable_causes: string[];
  corrective_action: AnswerStep[];
  citations: Citation[];
  confidence: "high" | "medium" | "low";
  refusals: string[];
  raw?: string;
}

/** Full pipeline request. */
export interface ChatRequest {
  message: string;
  /** Conversation history for follow-up context. */
  history?: ChatTurn[];
  /** Optional explicit single machine scope ("Press-2000"). */
  machine?: string;
  /** Override vector-DB query top-k. */
  top_k?: number;
  /** Minimum similarity to accept a chunk (hallucination gate). */
  min_score?: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Streaming pipeline result: either a text delta or a parseable answer event. */
export type StreamEvent =
  | { type: "context"; document: string; chunks: ScoredHit[] }
  | { type: "sources"; sources: ScoredHit[] }
  | { type: "answer"; answer: CitedAnswer }
  | { type: "text"; delta: string }
  | { type: "done"; answer?: CitedAnswer }
  | { type: "error"; message: string };

export interface IngestionRecord {
  document_id: string;
  title: string;
  page_count: number;
  chunk_count: number;
  indexed_at: string;
}

export interface ChatResult {
  answer: CitedAnswer;
  sources: ScoredHit[];
}

/** Generic vector store interface (Qdrant or in-memory). */
export interface VectorStore {
  index(chunks: Chunk[], vectors: number[][]): Promise<void>;
  query(vector: number[], topK?: number): Promise<ScoredHit[]>;
  deleteByDocument(documentId: string): Promise<void>;
}