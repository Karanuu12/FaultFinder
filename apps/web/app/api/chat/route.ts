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
import { startTrace, traceStep, endTrace } from "@/lib/query-progress";
import {
  type AnswerLanguage,
  languageInstruction,
  languageLabel,
  hasDevanagari,
} from "@/lib/language";
import type { ScoredChunk } from "@timmo/rag/store/local-store";
import type { FaultRecord } from "@timmo/rag/doc/model";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Citation {
  document_id: string;
  title: string;
  page: number;
  section: string;
  /**
   * The retrieved passage behind this citation, so the page viewer can
   * highlight the supporting sentences rather than just opening the page.
   */
  snippet?: string;
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
    // Carried so the page viewer can highlight the supporting text. Capped:
    // this rides in every chat response, and the renderer only searches the
    // first few dozen sentences anyway.
    snippet: c.text.slice(0, 1500),
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

/**
 * Query-vector LRU. The Jina embedQuery round-trip is 0.46-0.56s measured --
 * about 60% of total query latency -- and a technician re-asking or refining
 * the same phrasing pays it again every time. Bounded so a long-running
 * process can't grow it without limit.
 */
const QUERY_VEC_CACHE = new Map<string, number[]>();
const QUERY_VEC_CACHE_MAX = 500;

function cachedQueryVector(key: string): number[] | undefined {
  const hit = QUERY_VEC_CACHE.get(key);
  if (hit) {
    // Refresh recency: delete + re-set moves it to the end of insertion order.
    QUERY_VEC_CACHE.delete(key);
    QUERY_VEC_CACHE.set(key, hit);
  }
  return hit;
}

function putQueryVector(key: string, vector: number[]): void {
  if (QUERY_VEC_CACHE.size >= QUERY_VEC_CACHE_MAX) {
    const oldest = QUERY_VEC_CACHE.keys().next().value;
    if (oldest !== undefined) QUERY_VEC_CACHE.delete(oldest);
  }
  QUERY_VEC_CACHE.set(key, vector);
}

/**
 * Exact fault-code lookup, answered straight from the fault index -- no
 * embedding call, no LLM call.
 *
 * A FaultRecord already holds exactly what the answer format needs (meaning,
 * causes, corrective steps, provenance), extracted deterministically at
 * ingest. Sending that to an LLM to be re-worded costs ~0.5s of embedding
 * plus a generation round-trip and can only make it LESS faithful. Answer
 * directly when the record is complete; fall through to the normal pipeline
 * when it isn't.
 */
function answerFromFaultRecord(record: FaultRecord) {
  return {
    error_code: record.codeRaw,
    meaning: record.meaning,
    probable_causes: record.causes,
    corrective_action: record.steps.map((s) => ({ step: s.n, action: s.text })),
    citations: [
      {
        document_id: record.provenance.documentId,
        title: record.provenance.title,
        page: Number(record.provenance.pageLabel) || record.provenance.pagePdf,
        section: record.provenance.sectionPath.join(" › "),
      },
    ],
    images: [] as string[],
    confidence: "high" as const,
    refusals: [] as string[],
  };
}

/**
 * Is this record clean enough to serve verbatim, skipping the LLM?
 *
 * Only table-extracted records qualify. A fault TABLE has real column
 * separation, so `meaning`/`causes`/`steps` land in the right fields --
 * that's the case the extractor's tests cover. Section-extracted records come
 * from prose and can be mushy: one measured record put all five probable
 * causes into `steps` and split the real corrective actions mid-sentence.
 * Serving that directly would be faster AND worse, so those fall through to
 * the normal retrieval+LLM path, which re-reads the underlying chunks and
 * recovers. Speed is only worth taking when it costs nothing.
 */
function isFastPathQuality(record: FaultRecord): boolean {
  if (record.extraction !== "table_row") return false;
  if (!record.meaning?.trim()) return false;
  if (record.steps.length === 0) return false;
  // A table cell that exploded into dozens of "steps" is a parse artifact,
  // not a 30-step procedure.
  if (record.steps.length > 12) return false;
  return true;
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
  // Hoisted so the catch below can close the trace: the body is already
  // consumed by then, so it cannot be re-read there.
  let jobId: string | undefined;
  try {
    const body = await request.json();
    const { message, machine: explicitMachine } = body as { message?: string; machine?: string };
    jobId = typeof body?.job_id === "string" ? body.job_id : undefined;
    const language: AnswerLanguage = ["auto", "en", "hi", "mr"].includes(body?.language)
      ? body.language
      : "auto";
    const history = sanitizeHistory(body?.history);

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ error: "message is required (string)" }, { status: 400 });
    }

    // Trace is best-effort telemetry for the UI; every call is a no-op when
    // the client didn't send a job_id, so the endpoint's contract is unchanged.
    startTrace(jobId);

    const store = getStore();
    if (store.stats.chunks === 0) {
      endTrace(jobId);
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

    // --- Small talk: answered before anything is spent ---------------------
    if (SMALL_TALK.test(message.trim())) {
      const greetLang =
        language === "hi" || language === "mr"
          ? language
          : language === "auto" && hasDevanagari(message)
            ? "hi"
            : "en";
      traceStep(jobId, "Recognised a greeting", "no retrieval, no generation, 0 tokens");
      endTrace(jobId);
      return Response.json({
        answer: {
          meaning: GREETING[greetLang],
          probable_causes: [],
          corrective_action: [],
          citations: [],
          confidence: "high",
          refusals: [],
        },
        sources: [],
        fast_path: "small-talk",
      });
    }

    // --- Conversation memory: resolve machine + carried error code --------
    const candidates = machineCandidates(store);
    const resolvedMachine = resolveMachineScope(message, history, explicitMachine, candidates);
    const messageCodes = message.match(CODE_RE) ?? [];
    traceStep(
      jobId,
      "Read the question",
      [
        languageLabel(language, message),
        messageCodes.length ? `code ${messageCodes.join(", ")}` : "no explicit code",
        resolvedMachine
          ? `scoped to ${candidates.find((c) => c.machineId === resolvedMachine)?.label ?? resolvedMachine}`
          : `${candidates.length} manual${candidates.length === 1 ? "" : "s"} in scope`,
      ].join(" · "),
    );
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
        traceStep(
          jobId,
          "Checked for the same code in other manuals",
          ambiguous
            ? `${code} documented differently in ${new Set(records.map((r) => r.machineId)).size} manuals — asking which`
            : `${code}: ${records.length} record${records.length === 1 ? "" : "s"}, no conflict`,
        );
        if (ambiguous) {
          endTrace(jobId);
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

    // --- Exact fault-code fast path ---------------------------------------
    // A complete FaultRecord for a resolved machine already IS the answer, in
    // the exact shape the response format needs, extracted deterministically
    // at ingest. Skipping embedding + generation here turns a ~700ms query
    // into a few milliseconds with strictly higher fidelity -- the LLM can
    // only paraphrase what's already exact. Only taken when the record is
    // complete (has meaning AND steps); anything thinner falls through to the
    // full pipeline so we never trade an answer for speed.
    // The fast path returns the manual's own English wording verbatim, which is
    // exactly why it cannot hallucinate -- and exactly why it can't serve a
    // Hindi or Marathi question. When a non-English answer is wanted we give up
    // that determinism deliberately and route through generation so the reply
    // is in the technician's language; the answer is still grounded in the same
    // retrieved manual text, just paraphrased rather than quoted.
    const wantsNonEnglish = language === "hi" || language === "mr" || (language === "auto" && hasDevanagari(message));
    if (wantsNonEnglish && messageCodes.length === 1 && !history.length) {
      traceStep(jobId, "Skipped the fault-index fast path", "it answers in the manual's language; generating instead");
    }
    if (!wantsNonEnglish && messageCodes.length === 1 && !history.length) {
      const candidatesForCode = store.faultsForCode(messageCodes[0]);
      const scoped = resolvedMachine
        ? candidatesForCode.filter((r) => r.machineId === resolvedMachine)
        : candidatesForCode;
      const record = scoped.length === 1 ? scoped[0] : undefined;
      if (record && isFastPathQuality(record)) {
        traceStep(
          jobId,
          "Answered from the fault index",
          `exact ${record.extraction} record — no embedding or generation needed`,
        );
        endTrace(jobId);
        return Response.json({
          answer: answerFromFaultRecord(record),
          sources: [],
          resolved_machine: record.machineId,
          fast_path: "fault-index",
        });
      }
    }

    // --- Answer cache: an identical repeat costs nothing --------------------
    // Placed after machine resolution so the key reflects the scope actually
    // used, and skipped once a conversation is under way, since a follow-up's
    // meaning depends on turns the key does not capture.
    const s = store.stats;
    const fingerprint = `${s.documents}:${s.chunks}:${s.faults}`;
    const cacheKey = answerCacheKey(message, resolvedMachine, language, fingerprint);
    if (!history.length) {
      const hit = ANSWER_CACHE.get(cacheKey);
      if (hit) {
        // Refresh recency for the LRU.
        ANSWER_CACHE.delete(cacheKey);
        ANSWER_CACHE.set(cacheKey, hit);
        traceStep(jobId, "Served from the answer cache", "identical question, same index — 0 tokens");
        endTrace(jobId);
        return Response.json({
          answer: hit.answer,
          sources: [],
          resolved_machine: hit.resolved_machine,
          fast_path: "answer-cache",
        });
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
    // ~0.5s of the ~0.8s query is this one round-trip; cache it.
    let queryVector = cachedQueryVector(retrievalQuery);
    if (queryVector) {
      traceStep(jobId, "Embedded the query", `cache hit — ${queryVector.length} dims, no API call`);
    } else {
      queryVector = await embedder.embedQuery(retrievalQuery);
      putQueryVector(retrievalQuery, queryVector);
      traceStep(jobId, "Embedded the query", `${queryVector.length} dims via Jina`);
    }
    const hits = store.search(queryVector, retrievalQuery, { topK: 8, machineId: resolvedMachine });
    const retrievers = [...new Set(hits.flatMap((h) => h.matchedBy))];
    traceStep(
      jobId,
      "Retrieved passages",
      hits.length
        ? `${hits.length} from ${new Set(hits.map((h) => h.title)).size} manual${
            new Set(hits.map((h) => h.title)).size === 1 ? "" : "s"
          } · matched by ${retrievers.join(" + ")}`
        : "nothing matched",
    );

    if (hits.length === 0) {
      endTrace(jobId);
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
    const generated = groqKey
      ? await answerWithGroq(message, hits, groqKey, history, language)
      : { answer: answerFromRetrieval(hits), ok: false };
    const answer = generated.answer;

    // Only a real generation is worth replaying. Caching a rate-limited
    // fallback would serve raw manual text as though it were an answer, for as
    // long as the index stays unchanged.
    if (generated.ok && !history.length) {
      if (ANSWER_CACHE.size >= ANSWER_CACHE_MAX) {
        const oldest = ANSWER_CACHE.keys().next().value;
        if (oldest !== undefined) ANSWER_CACHE.delete(oldest);
      }
      ANSWER_CACHE.set(cacheKey, { answer, resolved_machine: resolvedMachine });
    }
    // Refusals are surfaced here too: an answer that fell back to raw retrieved
    // text reports "0 steps", which on its own reads like the pipeline simply
    // found nothing rather than like generation failing.
    traceStep(
      jobId,
      "Composed the answer",
      groqKey
        ? [
            `${answer.corrective_action.length} step${answer.corrective_action.length === 1 ? "" : "s"}`,
            `${answer.citations.length} citation${answer.citations.length === 1 ? "" : "s"}`,
            answer.refusals.length
              ? `${answer.refusals.length} caveat${answer.refusals.length === 1 ? "" : "s"} — see the answer`
              : null,
          ]
            .filter(Boolean)
            .join(", ")
        : "no GROQ_API_KEY — returned the retrieved text verbatim",
    );
    endTrace(jobId);

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
    // Mark the trace finished even on failure, so the client's poll stops
    // rather than hanging on a request that is never coming back.
    traceStep(jobId, "Failed", message.slice(0, 160));
    endTrace(jobId);
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
/**
 * ~3.6 chars/token, the same ratio the chunker and embedder use. Measured
 * against Groq's reported `prompt_tokens` the real ratio for this prompt is
 * ~4.3, so this deliberately over-estimates — the failure mode of guessing low
 * is a rejected request, and of guessing high is a slightly smaller context.
 */
function estTokens(text: string): number {
  return Math.ceil(text.length / 3.6);
}

/**
 * Greetings and acknowledgements, matched whole-message only.
 *
 * "hi" was costing a full pipeline run: a Jina query embedding, a hybrid
 * search, and ~3,000 tokens of system prompt sent to Groq to be told there is
 * no fault code in it. On a 200,000 token-per-day budget that is roughly 1/60th
 * of a day's capacity spent on a word that contains no question.
 *
 * Anchored at both ends and deliberately short, so "hi, what does OCF mean" is
 * NOT small talk and still runs the full pipeline.
 */
const SMALL_TALK =
  /^(hi|hii+|hey+|hello+|yo|hola|namaste|namaskar|thanks?|thank\s*you|thx|ty|ok(ay)?|k|cool|nice|great|awesome|got\s*it|bye|goodbye|see\s*ya|good\s*(morning|afternoon|evening|night)|नमस्ते|नमस्कार|धन्यवाद|शुक्रिया|ठीक\s*है|ओके)[\s!.?,…]*$/i;

/** Canned, so a greeting costs nothing even when answered in the user's language. */
const GREETING: Record<"en" | "hi" | "mr", string> = {
  en: "Ask me about a machine fault — an error code (like OCF or F0001), a symptom, or a machine name. Every answer is drawn from the manuals you've uploaded and cited by page.",
  hi: "मुझसे मशीन की खराबी के बारे में पूछें — एरर कोड (जैसे OCF या F0001), कोई लक्षण, या मशीन का नाम। हर उत्तर आपके अपलोड किए गए मैनुअल से लिया जाता है और पेज नंबर के साथ दिया जाता है।",
  mr: "मला मशीनच्या बिघाडाबद्दल विचारा — एरर कोड (उदा. OCF किंवा F0001), एखादे लक्षण, किंवा मशीनचे नाव. प्रत्येक उत्तर तुम्ही अपलोड केलेल्या मॅन्युअलमधून घेतले जाते आणि पृष्ठ क्रमांकासह दिले जाते.",
};

/**
 * Identical questions answered again cost nothing.
 *
 * Rehearsing a demo means asking the same five questions twenty times. Without
 * this, that is twenty full generations against a daily cap that allows roughly
 * thirty. Keyed on the index fingerprint as well as the question, so uploading
 * or deleting a manual invalidates every cached answer rather than serving a
 * stale one. Only successful generations are cached — a rate-limited fallback
 * must never be replayed as if it were an answer.
 */
const ANSWER_CACHE = new Map<string, { answer: unknown; resolved_machine?: string }>();
const ANSWER_CACHE_MAX = 200;

function answerCacheKey(
  message: string,
  machine: string | undefined,
  language: AnswerLanguage,
  fingerprint: string,
): string {
  return [
    message.toLowerCase().replace(/\s+/g, " ").trim(),
    machine ?? "-",
    language,
    fingerprint,
  ].join("|");
}

/**
 * Groq's free tier caps TOKENS PER MINUTE per model, and both models available
 * on this account are capped at 8,000 (read straight off
 * `x-ratelimit-limit-tokens`). A single request can therefore exceed the whole
 * minute's budget on its own -- which is exactly what was happening: the system
 * prompt is ~3,600 tokens, eight retrieved chunks at the 90th percentile are
 * ~3,800 more, plus the output reservation. That is ~9,000 against a cap of
 * 8,000, so the request 429s before it is ever throttled for frequency.
 *
 * Every "rate limit" seen while building this was that, not query volume.
 *
 * So the context is filled to a measured budget instead of blindly sending
 * topK. Hits are added in rank order -- retrieval still returns 8 and the
 * citation list is still built from all of them -- and the first one that does
 * not fit is truncated into whatever space remains. The highest-ranked
 * evidence is therefore always present and complete, and the request cannot
 * exceed the cap regardless of how large the retrieved chunks happen to be.
 */
const GROQ_TPM_CAP = Number(process.env.GROQ_TPM_CAP ?? 8000);
const GROQ_MAX_OUTPUT = 900;
/** Headroom for the JSON schema line, role overhead, and estimator error. */
const GROQ_SAFETY = 500;

/**
 * Groq's free tier caps this account at 8,000 tokens per minute. A grounded
 * answer costs ~5,000 of them — the system prompt is ~2,700 before any manual
 * text is added — so a single key allows roughly ONE substantive question per
 * minute. During a live demo that is the difference between answering the
 * judge's second question and showing them a rate-limit fallback.
 *
 * The prompt cannot be shrunk far enough to fix this without deleting real
 * hallucination rules, which is the wrong trade for this product. So
 * GROQ_API_KEY accepts a comma-separated list instead: each key carries its
 * own quota, and a 429 fails over to the next rather than degrading the
 * answer. One key still works exactly as before.
 */
function groqKeys(): string[] {
  return (process.env.GROQ_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * `openai/gpt-oss-*` on Groq is a reasoning model: it spends hidden
 * "reasoning" tokens (`usage.completion_tokens_details.reasoning_tokens`)
 * before writing the visible answer, and those tokens count against the same
 * per-minute/per-day budget as everything else. Measured directly against
 * this account with the real system prompt and a real single-fact question:
 *
 *   reasoning_effort   reasoning_tokens   completion_tokens   total_tokens
 *   (default/unset)    256                363                 3151
 *   "low"              53-81              168-181             2956-2969
 *   "medium"           248                380                 3168
 *
 * Unset behaves like "medium", not like a minimum. "low" answered the same
 * question correctly (right fact, right confidence, right used_sources) at
 * roughly half the completion-token cost -- on a 200,000 token/day budget,
 * that is real query headroom, not a rounding difference. Every request that
 * goes through the fault-index fast path or the answer cache pays none of
 * this either way; this only affects generation that actually reaches Groq.
 *
 * Kept adjustable rather than hardcoded, and scoped to models that are
 * actually known to accept the parameter: Groq's API rejects an unsupported
 * value outright (HTTP 400) rather than ignoring it, so sending this to a
 * model that doesn't understand it could turn a working request into a
 * failed one. If GROQ_MODEL is ever pointed at something else, this quietly
 * stops adding the field instead of guessing.
 */
function reasoningEffortFor(model: string): { reasoning_effort?: "low" | "medium" | "high" } {
  if (!model.includes("gpt-oss")) return {};
  const requested = process.env.GROQ_REASONING_EFFORT;
  const effort = requested === "low" || requested === "medium" || requested === "high" ? requested : "low";
  return { reasoning_effort: effort };
}

function buildContext(hits: ScoredChunk[], promptTokens: number): string {
  let budget = GROQ_TPM_CAP - GROQ_MAX_OUTPUT - GROQ_SAFETY - promptTokens;
  const parts: string[] = [];

  hits.forEach((h, i) => {
    if (budget <= 0) return;
    const head = `[S${i + 1}] ${h.sectionPath.join(" › ")} (page ${h.pageLabel})\n`;
    const headCost = estTokens(head);
    if (budget - headCost < 60) return; // no room for meaningful body
    const bodyBudgetChars = Math.floor((budget - headCost) * 3.6);
    const body =
      h.text.length <= bodyBudgetChars ? h.text : `${h.text.slice(0, bodyBudgetChars)}…[truncated]`;
    parts.push(head + body);
    budget -= headCost + estTokens(body);
  });

  // A budget so tight that nothing fit would send empty context and invite the
  // model to answer from nothing -- send the top hit clipped instead.
  if (parts.length === 0 && hits.length) {
    const h = hits[0];
    parts.push(`[S1] ${h.sectionPath.join(" › ")} (page ${h.pageLabel})\n${h.text.slice(0, 2000)}`);
  }
  return parts.join("\n\n");
}

async function answerWithGroq(
  message: string,
  hits: ScoredChunk[],
  apiKey: string,
  history: HistoryTurn[] = [],
  language: AnswerLanguage = "auto",
) {
  // Stated in the system message rather than the user turn: as a preference
  // buried before the output schema it was simply ignored, because the source
  // excerpts are English and the model followed them.
  const langRule = languageInstruction(language, message);
  const system = langRule ? `${getHallucinationSkill()}\n\n${langRule}` : getHallucinationSkill();
  const historyTurns = history.slice(-6);
  const context = buildContext(
    hits,
    estTokens(system) + historyTurns.reduce((s, h) => s + estTokens(h.content), 0),
  );

  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

  const body = JSON.stringify({
      model,
      temperature: 0.15,
      max_tokens: GROQ_MAX_OUTPUT,
      ...reasoningEffortFor(model),
      messages: [
        { role: "system", content: system },
        // Real prior turns, not a paraphrase stuffed into the user message --
        // this is what lets the model correctly read an elliptical follow-up
        // ("and what if that doesn't fix it?") as a continuation, while the
        // skill prompt above still requires every CLAIM to be re-grounded in
        // this turn's numbered excerpts, not just carried from a past turn.
        ...historyTurns.map((h) => ({ role: h.role, content: h.content })),
        {
          role: "user",
          content:
            `CONTEXT:\n${context}\n\nQUESTION: ${message}\n\n` +
            `Output JSON: {"error_code":"","meaning":"","probable_causes":[],` +
            `"corrective_action":[{"step":1,"action":""}],"used_sources":[1,2],` +
            `"confidence":"high|medium|low","refusals":[]}`,
        },
      ],
  });

  // Try each key in turn; a key that is out of quota fails over rather than
  // degrading the answer. `apiKey` is the first key and is kept as the
  // parameter so the call site is unchanged.
  const keys = groqKeys();
  const ordered = keys.length ? keys : [apiKey];
  let res: Response | undefined;
  for (let i = 0; i < ordered.length; i++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ordered[i]}` },
      body,
    });
    if (res.status !== 429) break;
    if (i < ordered.length - 1) {
      console.warn(`[groq] key ${i + 1}/${ordered.length} rate-limited, failing over`);
    }
  }

  if (!res || !res.ok) {
    const detail = res ? await res.text().catch(() => "") : "no response";
    console.warn("Groq failed, falling back to retrieval:", detail.slice(0, 200));
    return {
      ok: false,
      answer: answerFromRetrieval(
        hits,
        `The answer-generation model returned an error (${res?.status ?? "no response"})${ordered.length > 1 ? ` on all ${ordered.length} keys` : ""}, so this is the retrieved manual text rather than a generated answer.`,
      ),
    };
  }

  const raw = await res.json();
  const content: string = raw.choices?.[0]?.message?.content ?? "";
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return {
      ok: false,
      answer: answerFromRetrieval(
        hits,
        "The answer-generation model's response wasn't valid JSON, so this is the retrieved manual text rather than a generated answer.",
      ),
    };
  }

  try {
    const parsed = JSON.parse(content.slice(start, end + 1));
    // Citations are resolved from the sources the model actually used —
    // it never gets to invent a page number.
    const used: number[] = Array.isArray(parsed.used_sources) ? parsed.used_sources : [];
    const citedHits = used.map((n: number) => hits[n - 1]).filter(Boolean);
    const fallbackHits = citedHits.length ? citedHits : hits.slice(0, 3);

    return {
      ok: true,
      answer: {
      error_code: parsed.error_code || undefined,
      meaning: String(parsed.meaning ?? ""),
      probable_causes: Array.isArray(parsed.probable_causes) ? parsed.probable_causes : [],
      corrective_action: Array.isArray(parsed.corrective_action) ? parsed.corrective_action : [],
      citations: fallbackHits.map(citationFor),
      images: imagesFor(fallbackHits),
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
      refusals: Array.isArray(parsed.refusals) ? parsed.refusals : [],
      },
    };
  } catch {
    return {
      ok: false,
      answer: answerFromRetrieval(
        hits,
        "The answer-generation model's response couldn't be parsed as the expected JSON shape, so this is the retrieved manual text rather than a generated answer.",
      ),
    };
  }
}
