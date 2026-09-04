/**
 * POST /api/chat — answer a troubleshooting question from the indexed manuals.
 *
 *   query → Jina query embedding
 *         → hybrid retrieval (exact code index + lexical + dense, RRF-fused)
 *         → ambiguity check against the fault index
 *         → Groq (optional) with [S#]-tagged context
 *         → citations mapped from chunk ids, never written by the LLM
 *
 * Degrades on purpose: with no GROQ_API_KEY it still returns a cited,
 * evidence-backed answer built from retrieval alone, so the pipeline is
 * demonstrable before every key is in place.
 */
import { NextRequest } from "next/server";
import { getStore, getEmbedder } from "@/lib/rag-index";
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

/** Phase 9: the same code meaning different things on different machines. */
function checkAmbiguity(records: FaultRecord[]): { ambiguous: boolean; question: string } {
  const byMachine = new Map<string, FaultRecord>();
  for (const r of records) if (!byMachine.has(r.machineId)) byMachine.set(r.machineId, r);
  if (byMachine.size < 2) return { ambiguous: false, question: "" };

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
    const { message, machine } = body as { message?: string; machine?: string };

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

    // --- Ambiguity check runs before anything expensive -------------------
    const codes = message.match(/\b([A-Za-z]{1,3}\d{2,5}|[A-Za-z]{2,4}F)\b/g) ?? [];
    for (const code of codes) {
      const records = store.faultsForCode(code);
      const { ambiguous, question } = checkAmbiguity(records);
      if (ambiguous && !machine) {
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

    // --- Retrieval --------------------------------------------------------
    const embedder = getEmbedder();
    const queryVector = await embedder.embedQuery(message);
    const hits = store.search(queryVector, message, { topK: 8, machineId: machine });

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

    // --- Answer -----------------------------------------------------------
    const groqKey = process.env.GROQ_API_KEY;
    const answer = groqKey
      ? await answerWithGroq(message, hits, groqKey)
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
    });
  } catch (err) {
    console.error("/api/chat error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

/** No LLM key: return the evidence itself, correctly cited. Honest, not clever. */
function answerFromRetrieval(hits: ScoredChunk[]) {
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
    refusals: [
      "GROQ_API_KEY is not set, so this is the retrieved manual text rather than a generated answer.",
    ],
  };
}

/** With a key: the LLM phrases the answer, but citations come from chunk ids. */
async function answerWithGroq(message: string, hits: ScoredChunk[], apiKey: string) {
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
        {
          role: "system",
          content:
            "You answer machine-troubleshooting questions strictly from the supplied manual excerpts. " +
            "Tag every claim with the source it came from, e.g. [S2]. If the excerpts do not answer " +
            "the question, say so in refusals rather than guessing. Some sources are figures or " +
            "diagrams, marked with a leading [Figure] line — include one of those in used_sources " +
            "whenever it is the diagram, drawing, wiring layout, or dimension illustration the question " +
            "is actually asking about, not just because it appeared in the context. The actual image is " +
            "rendered separately below your answer whenever you cite a [Figure] source — never say the " +
            "drawing 'cannot be shown' or that you lack the actual image; instead describe what it shows " +
            "and let the rendered figure speak for itself. Output JSON only.",
        },
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
    return answerFromRetrieval(hits);
  }

  const raw = await res.json();
  const content: string = raw.choices?.[0]?.message?.content ?? "";
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return answerFromRetrieval(hits);

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
    return answerFromRetrieval(hits);
  }
}
