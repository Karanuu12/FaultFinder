/**
 * POST /api/chat — answer a troubleshooting question from the indexed manuals.
 *
 *   query → resolve machine scope (explicit → current message → conversation
 *           history) → augment the retrieval query with carried-forward
 *           context for vague follow-ups
 *         → Jina query embedding
 *         → hybrid retrieval (exact code index + lexical + dense, RRF-fused),
 *           scoped to the resolved machine when one is known
 *         → ambiguity check against the fault index (skipped once a machine
 *           is already established — that's the whole point of memory)
 *         → Groq (optional) with [S#]-tagged context AND real multi-turn
 *           conversation history, with [Figure] awareness
 *         → citations mapped from chunk ids, never written by the LLM
 *
 * Degrades on purpose: with no GROQ_API_KEY it still returns a cited,
 * evidence-backed answer built from retrieval alone, so the pipeline is
 * demonstrable before every key is in place.
 */
import { NextRequest } from "next/server";
import { getStore, getEmbedder } from "@/lib/rag-index";
import { getHallucinationSkill } from "@/lib/prompts/skill";
import type { ScoredChunk } from "@timmo/rag/store/local-store";
import type { FaultRecord } from "@timmo/rag/doc/model";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Citation {
  document_id: string;
  title: string;
  page: number;
  section: string;
}

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

function citationFor(c: ScoredChunk): Citation {
  return {
    document_id: c.documentId,
    title: c.title,
    // The printed page label is what a technician looks for, not the PDF index.
    page: Number(c.pageLabel) || c.pagePdf,
    section: c.sectionPath.join(" › "),
  };
}

/**
 * Diagrams/figures attached to the answer, sourced ONLY from the chunks that
 * were actually cited — not the whole retrieved pool. That keeps images tied
 * to what the answer references rather than showing every diagram that
 * happened to be nearby in the manual.
 */
function imagesFor(hits: ScoredChunk[]): string[] {
  return [...new Set(hits.flatMap((h) => h.figureRefs ?? []))].filter(Boolean).slice(0, 6);
}

// ---------------------------------------------------------------------------
// Conversation memory: machine + error-code carry-forward
// ---------------------------------------------------------------------------

/**
 * ABB drives use F0001/A2001; Schneider uses OCF/SOF (3-4 letter mnemonics);
 * generic manuals use E101/b005. Deliberately conservative -- a looser
 * pattern turns ordinary words into "codes" and corrupts both ambiguity
 * detection and retrieval.
 */
const CODE_RE = /\b([A-Za-z]{1,3}\d{2,5}|[A-Za-z]{2,4}F)\b/g;

/** Turn a machine label into a regex that's tolerant of spacing/hyphenation: "ACS150" also matches "ACS 150" / "acs-150". */
function toMachinePattern(label: string): RegExp {
  const parts = label.match(/[A-Za-z]+|\d+/g) ?? [label];
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b${escaped.join("[\\s-]?")}\\b`, "i");
}

interface MachineCandidate {
  machineId: string;
  label: string;
  pattern: RegExp;
}

/**
 * Built fresh from whatever's actually indexed right now (store.listDocuments()),
 * not a hardcoded list. A hardcoded machine list goes stale the moment someone
 * uploads a new manual; this one can't.
 */
function machineCandidates(store: ReturnType<typeof getStore>): MachineCandidate[] {
  return store.listDocuments().map((d) => {
    const label = d.model || d.machineId;
    return { machineId: d.machineId, label, pattern: toMachinePattern(label) };
  });
}

function detectMachineIn(text: string, candidates: MachineCandidate[]): MachineCandidate | undefined {
  return candidates.find((c) => c.pattern.test(text));
}

/**
 * Resolve which machine this turn is about, in priority order:
 *   1. explicit `machine` field (API callers that already know)
 *   2. a machine named in THIS message (the current message always wins --
 *      a technician switching machines mid-conversation must not be stuck
 *      with the old one)
 *   3. a machine established earlier in the conversation, most recent first
 *
 * This directly implements the disambiguation clues the project's own
 * problem statement calls for: "machine name, model number, conversation
 * history, document metadata" -- in that order of trust.
 */
function resolveMachineScope(
  message: string,
  history: HistoryTurn[],
  explicitMachine: string | undefined,
  candidates: MachineCandidate[],
): string | undefined {
  if (explicitMachine) return explicitMachine;

  const inMessage = detectMachineIn(message, candidates);
  if (inMessage) return inMessage.machineId;

  for (let i = history.length - 1; i >= 0; i--) {
    const found = detectMachineIn(history[i]?.content ?? "", candidates);
    if (found) return found.machineId;
  }
  return undefined;
}

/** Most recent error code mentioned anywhere in history, newest turn first. */
function lastCodeFromHistory(history: HistoryTurn[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = (history[i]?.content ?? "").match(CODE_RE);
    if (m) return m[m.length - 1];
  }
  return undefined;
}

/**
 * Client-supplied history feeds directly into the LLM's message array, which
 * makes it a prompt-injection surface if trusted blindly. Coerce role to
 * exactly "user"/"assistant" (never let a client claim "system"), cap each
 * turn's length, and cap how many turns we even look at.
 */
function sanitizeHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryTurn[] = [];
  for (const item of raw.slice(-20)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) continue;
    out.push({ role, content: content.slice(0, 1500) });
  }
  return out;
}

/** Phase 9: the same code meaning different things on different machines. */
function checkAmbiguity(records: FaultRecord[]): { ambiguous: boolean; question: string } {
  const byMachine = new Map<string, FaultRecord>();
  for (const r of records) if (!byMachine.has(r.machineId)) byMachine.set(r.machineId, r);
  if (byMachine.size < 2) return { ambiguous: false, question: "" };

  // Same code, same meaning on every machine that has it -- not actually
  // ambiguous. Cheap normalized-string comparison, no embedding call needed:
  // deterministic and fast, in keeping with "not a prompt/LLM trick."
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const distinctMeanings = new Set([...byMachine.values()].map((r) => normalize(r.meaning || "")));
  if (distinctMeanings.size <= 1) return { ambiguous: false, question: "" };

  const options = [...byMachine.values()]
    .map((r) => `**${r.model ?? r.machineId}** — ${r.meaning || "see manual"}`)
    .join("; ");
  return {
    ambiguous: true,
    question: `That code appears in more than one manual with different meanings: ${options}. Which machine are you working on?`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, machine: explicitMachine } = body as { message?: string; machine?: string };
    const history = sanitizeHistory(body?.history);

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ error: "message is required (string)" }, { status: 400 });
    }

    const store = getStore();
    if (store.stats.chunks === 0) {
      return Response.json({
        answer: {
          meaning: "No manuals have been indexed yet.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals: ["Upload a PDF manual first — use the Upload PDF button above."],
        },
        sources: [],
      });
    }

    // --- Conversation memory: resolve machine + carried error code --------
    const candidates = machineCandidates(store);
    const resolvedMachine = resolveMachineScope(message, history, explicitMachine, candidates);
    const messageCodes = message.match(CODE_RE) ?? [];
    // Only borrow a code from history when THIS message doesn't name one --
    // an explicit code in the current message always wins.
    const carriedCode = messageCodes.length ? undefined : lastCodeFromHistory(history);

    // --- Ambiguity check runs before anything expensive --------------------
    // Skipped entirely once a machine is already known -- that's the point
    // of remembering: "Machine A shows E101" -> "and what if that doesn't
    // fix it?" must not re-ask which machine.
    if (!resolvedMachine) {
      for (const code of messageCodes) {
        const records = store.faultsForCode(code);
        const { ambiguous, question } = checkAmbiguity(records);
        if (ambiguous) {
          return Response.json({
            answer: {
              error_code: code,
              meaning: question,
              probable_causes: [],
              corrective_action: [],
              citations: records.map((r) => ({
                document_id: r.provenance.documentId,
                title: r.provenance.title,
                page: Number(r.provenance.pageLabel) || r.provenance.pagePdf,
                section: r.provenance.sectionPath.join(" › "),
              })),
              confidence: "high",
              refusals: [],
            },
            sources: [],
            ambiguous: true,
          });
        }
      }
    }

    // --- Retrieval ----------------------------------------------------------
    // A vague follow-up ("and what if that doesn't fix it?") carries no
    // retrievable terms on its own. Augmenting the SEARCH text (not the
    // question shown to the LLM) with carried-forward code/machine is what
    // makes retrieval for a follow-up actually find the right section, not
    // just the LLM's own memory of the conversation.
    const machineLabel = candidates.find((c) => c.machineId === resolvedMachine)?.label;
    const retrievalQuery = [carriedCode, machineLabel, message].filter(Boolean).join(" ");

    const embedder = getEmbedder();
    const queryVector = await embedder.embedQuery(retrievalQuery);
    const hits = store.search(queryVector, retrievalQuery, { topK: 8, machineId: resolvedMachine });

    if (hits.length === 0) {
      return Response.json({
        answer: {
          meaning: "Nothing in the indexed manuals matches that question.",
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "low",
          refusals: [
            "No relevant content found. Try naming the machine (e.g. ACS150) or an exact error code.",
          ],
        },
        sources: [],
      });
    }

    // --- Answer ---------------------------------------------------------
    const groqKey = process.env.GROQ_API_KEY;
    const answer = groqKey
      ? await answerWithGroq(message, hits, groqKey, history)
      : answerFromRetrieval(hits);

    return Response.json({
      answer,
      sources: hits.map((h) => ({
        document_id: h.documentId,
        title: h.title,
        page: Number(h.pageLabel) || h.pagePdf,
        section: h.sectionPath.join(" › "),
        text: h.text.slice(0, 1200),
        score: Number(h.score.toFixed(4)),
        matched_by: h.matchedBy,
      })),
      resolved_machine: resolvedMachine,
    });
  } catch (err) {
    console.error("/api/chat error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * Fallback answer built from retrieval alone, no LLM phrasing. Used both when
 * there's no GROQ_API_KEY at all, and as answerWithGroq's own fallback when
 * the call fails or its response doesn't parse -- those are different
 * situations and get different refusal text. A refusal that misdiagnoses its
 * own cause is a small credibility problem in exactly the area this file's
 * skill prompt is trying to protect.
 */
function answerFromRetrieval(
  hits: ScoredChunk[],
  reason = "GROQ_API_KEY is not set, so this is the retrieved manual text rather than a generated answer.",
) {
  const best = hits[0];
  const body = best.text.split("\n\n").slice(1).join("\n\n").trim() || best.text;
  const cited = hits.slice(0, 4);
  return {
    meaning: body.slice(0, 600),
    probable_causes: [],
    corrective_action: [],
    citations: cited.map(citationFor),
    images: imagesFor(cited),
    confidence: "medium" as const,
    refusals: [reason],
  };
}

/** With a key: the LLM phrases the answer, sees real conversation history, but citations come from chunk ids. */
async function answerWithGroq(
  message: string,
  hits: ScoredChunk[],
  apiKey: string,
  history: HistoryTurn[] = [],
) {
  const context = hits
    .map((h, i) => `[S${i + 1}] ${h.sectionPath.join(" › ")} (page ${h.pageLabel})\n${h.text}`)
    .join("\n\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.15,
      max_tokens: 1600,
      messages: [
        { role: "system", content: getHallucinationSkill() },
        // Real prior turns, not a paraphrase stuffed into the user message --
        // this is what lets the model correctly read an elliptical follow-up
        // ("and what if that doesn't fix it?") as a continuation, while the
        // skill prompt above still requires every CLAIM to be re-grounded in
        // this turn's numbered excerpts, not just carried from a past turn.
        ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
        {
          role: "user",
          content:
            `CONTEXT:\n${context}\n\nQUESTION: ${message}\n\n` +
            `Output JSON: {"error_code":"","meaning":"","probable_causes":[],` +
            `"corrective_action":[{"step":1,"action":""}],"used_sources":[1,2],` +
            `"confidence":"high|medium|low","refusals":[]}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn("Groq failed, falling back to retrieval:", detail.slice(0, 200));
    return answerFromRetrieval(
      hits,
      `The answer-generation model returned an error (${res.status}), so this is the retrieved manual text rather than a generated answer.`,
    );
  }

  const raw = await res.json();
  const content: string = raw.choices?.[0]?.message?.content ?? "";
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return answerFromRetrieval(
      hits,
      "The answer-generation model's response wasn't valid JSON, so this is the retrieved manual text rather than a generated answer.",
    );
  }

  try {
    const parsed = JSON.parse(content.slice(start, end + 1));
    // Citations are resolved from the sources the model actually used —
    // it never gets to invent a page number.
    const used: number[] = Array.isArray(parsed.used_sources) ? parsed.used_sources : [];
    const citedHits = used.map((n: number) => hits[n - 1]).filter(Boolean);
    const fallbackHits = citedHits.length ? citedHits : hits.slice(0, 3);

    return {
      error_code: parsed.error_code || undefined,
      meaning: String(parsed.meaning ?? ""),
      probable_causes: Array.isArray(parsed.probable_causes) ? parsed.probable_causes : [],
      corrective_action: Array.isArray(parsed.corrective_action) ? parsed.corrective_action : [],
      citations: fallbackHits.map(citationFor),
      images: imagesFor(fallbackHits),
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
      refusals: Array.isArray(parsed.refusals) ? parsed.refusals : [],
    };
  } catch {
    return answerFromRetrieval(
      hits,
      "The answer-generation model's response couldn't be parsed as the expected JSON shape, so this is the retrieved manual text rather than a generated answer.",
    );
  }
}
