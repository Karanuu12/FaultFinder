import { GroqClient } from "@timmo/rag";

export function makeLLM(): GroqClient {
  return new GroqClient({
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b",
  });
}