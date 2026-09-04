/**
 * Groq LLM client (hosted, free tier).
 * Calls Groq's chat completions API directly with supporting context.
 */
import { z } from "zod";
import type { ChatTurn, CitedAnswer, AnswerStep, Citation, ScoredHit } from "./types";

export interface LLMConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

const GROQ_BASE = "https://api.groq.com/openai/v1";

const STRUCTURED_ANSWER_SCHEMA = z.object({
  error_code: z.string().optional(),
  meaning: z.string(),
  probable_causes: z.array(z.string()),
  corrective_action: z.array(z.object({ step: z.number(), action: z.string() })),
  citations: z.array(z.object({ document_id: z.string(), title: z.string(), page: z.number(), section: z.string() })),
  confidence: z.enum(["high", "medium", "low"]),
  refusals: z.array(z.string()),
});

export class GroqClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "llama-3.3-70b-versatile";
    this.baseUrl = config.baseUrl ?? GROQ_BASE;
  }

  /**
   * Generate a structured, cited answer from retrieved context + conversation history.
   */
  async generateAnswer(
    message: string,
    context: ScoredHit[],
    history: ChatTurn[] = [],
    machineScope?: string,
  ): Promise<CitedAnswer> {
    const contextBlock = context.length
      ? context.map((h, i) =>
          `[${i}] Document: ${h.title} | Page ${h.page} | Section: ${h.section}\n${h.text}`
        ).join("\n\n")
      : "NO RELEVANT CONTEXT FOUND";

    const machineHint = machineScope
      ? `\nThe user specifically mentioned the machine: "${machineScope}". Prioritize its manual.`
      : "";

    const systemPrompt = [
      "You are a precise factory-troubleshooting assistant. Your job is to answer the user's question",
      "SOLELY from the retrieved context blocks below. NEVER invent an answer that isn't supported.",
      "",
      "Rules:",
      "1. If the context is empty or insufficient, set refusals and return confidence 'low'.",
      "2. If the same error code appears in multiple manuals, cite only the one matching the machine.",
      "3. Every claim must be traceable to a citation in the context.",
      "4. Output structured JSON (no markdown, no code fences).",
      "5. Follow-up questions: use conversation history for continuity.",
      machineHint,
    ].filter(Boolean).join("\n");

    const userPrompt =
      `CONTEXT BLOCKS:\n${contextBlock}\n\n${machineHint}\n\n` +
      `USER QUESTION: ${message}\n\n` +
      `Respond with JSON only:\n` +
      `{ "error_code": "E101" | null, "meaning": "...", "probable_causes": ["..."], ` +
      `"corrective_action": [{"step": 1, "action": "..."}], ` +
      `"citations": [{"document_id": "...", "title": "...", "page": 0, "section": "..."}], ` +
      `"confidence": "high"|"medium"|"low", ` +
      `"refusals": ["..."] }`;

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6).map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: userPrompt },
    ];

    const body = {
      model: this.model,
      messages,
      temperature: 0.15,
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Groq LLM error (${res.status}): ${detail.slice(0, 400)}`);
    }

    const raw = await res.json();
    const choice = raw.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error("Groq returned empty response.");
    }

    const content = choice.message.content;
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = STRUCTURED_ANSWER_SCHEMA.parse(JSON.parse(cleaned));

    return {
      ...parsed,
      raw: content,
    };
  }

  /** Simple text-only Q&A (follow-up negotiation, clarifying questions). */
  async generateText(
    prompt: string,
    system = "You are a factory-troubleshooting assistant. Be concise.",
  ): Promise<string> {
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Groq text error (${res.status}): ${detail.slice(0, 300)}`);
    }

    const raw = await res.json();
    return raw.choices?.[0]?.message?.content ?? "";
  }
}