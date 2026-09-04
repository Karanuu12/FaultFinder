import { NextRequest } from "next/server";
import { OllamaEmbeddingClient, RagPipeline } from "@timmo/rag";
import { makeVectorStore } from "@/lib/rag-store";
import { makeLLM } from "@/lib/rag-llm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history, machine, top_k, min_score } = body;

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "message is required (string)" },
        { status: 400 },
      );
    }

    const embedder = new OllamaEmbeddingClient();

    const llm = makeLLM();
    const vectorStore = makeVectorStore();
    const pipeline = new RagPipeline({ embedder, vectorStore, llm });

    const result = await pipeline.query({
      message,
      history: history ?? [],
      machine,
      top_k,
      min_score,
    });

    return Response.json(result);
  } catch (err) {
    console.error("/api/chat error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}