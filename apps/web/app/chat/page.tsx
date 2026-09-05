"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Loader2,
  Upload,
  FileText,
  Menu,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Volume2,
  VolumeX,
  Mic,
  ArrowUpRight,
} from "lucide-react";

interface Citation {
  document_id: string;
  title: string;
  page: number;
  section: string;
}
interface AnswerStep {
  step: number;
  action: string;
}
interface CitedAnswer {
  error_code?: string;
  meaning: string;
  probable_causes: string[];
  corrective_action: AnswerStep[];
  citations: Citation[];
  images?: string[];
  confidence: "high" | "medium" | "low";
  refusals: string[];
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  structured?: CitedAnswer;
}

/**
 * Natural-language summary of a structured answer, for sending as
 * conversation history. Sending the raw CitedAnswer JSON back to the LLM as
 * "what was said" is both token-wasteful and a worse read for the model than
 * the plain-English answer it would have produced anyway -- this is what the
 * model actually sees as its own prior turn.
 */
function summarizeForHistory(a: CitedAnswer): string {
  const parts: string[] = [];
  if (a.error_code) parts.push(`${a.error_code}:`);
  if (a.meaning) parts.push(a.meaning);
  if (a.probable_causes.length) parts.push(`Probable causes: ${a.probable_causes.join("; ")}.`);
  if (a.corrective_action.length) {
    parts.push(`Steps: ${a.corrective_action.map((s) => s.action).join(" ")}`);
  }
  if (a.refusals.length) parts.push(a.refusals.join(" "));
  return parts.join(" ").slice(0, 800);
}
interface IndexStats {
  documents: number;
  chunks: number;
  faults: number;
  dims: number;
  machines: string[];
  documents_list?: {
    document_id: string;
    title: string;
    model?: string;
    pages: number;
    chunks?: number;
    faults?: number;
  }[];
}

/**
 * Confidence is the one place colour carries meaning rather than decoration,
 * so it uses the landing page's own accent hues instead of a fresh palette.
 */
const CONFIDENCE_STYLE: Record<CitedAnswer["confidence"], { dot: string; text: string }> = {
  high: { dot: "bg-[#359462]", text: "text-[#2f7c53]" },
  medium: { dot: "bg-[#c98a2b]", text: "text-[#a8711f]" },
  low: { dot: "bg-[#c64e27]", text: "text-[#b04520]" },
};

/** Small-caps section label. One typographic device, used consistently. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
      {children}
    </p>
  );
}

/**
 * The model emits per-claim source references inline as 【S1】. Rendered raw
 * they read as garbled output; dropped entirely we would lose the one thing
 * that ties an individual sentence to a page. So they are parsed into
 * superscript chips carrying the actual page number, hoverable for the
 * section path -- the citation survives and stops looking like a glitch.
 */
/**
 * The model is inconsistent about the bracket style, so both are matched. The
 * square-bracket form is deliberately narrow -- `S` followed only by digits --
 * because manuals are full of genuine bracketed parameter names ([Settings],
 * [Motor control], [Fault Reset Assign]) that must survive untouched. Anything
 * A marker that points past the end of the citation list means the model
 * referenced a source that was not actually returned -- worth flagging, not
 * hiding, on a product whose whole claim is that nothing is asserted without a
 * page behind it. Text that merely looks like a marker but resolves to nothing
 * numeric is left exactly as written, so a real parameter name is never
 * silently swallowed.
 */
// Built per call rather than shared: a /g regex carries a mutable lastIndex,
// and one instance reused across renders would skip matches unpredictably.
const sourceMarker = () => /【\s*S(\d+)\s*】|\[\s*S(\d+)\s*\]/g;

function CitedText({ text, citations }: { text: string; citations: Citation[] }) {
  if (!text.includes("【") && !text.includes("[S")) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = sourceMarker();
  while ((m = re.exec(text)) !== null) {
    const cite = citations[Number(m[1] ?? m[2]) - 1];
    // Markers usually trail a space before the sentence's period; trimming the
    // preceding space keeps punctuation tight against the chip.
    parts.push(text.slice(last, m.index).replace(/\s+$/, ""));
    parts.push(
      cite ? (
        <sup
          key={`${m.index}-c`}
          title={`${citationLabel(cite.title)} — ${cite.section}`}
          className="ml-0.5 inline-flex -translate-y-px items-center rounded-[5px] bg-neutral-100 px-1 py-px align-baseline text-[9.5px] font-semibold tabular-nums text-neutral-500"
        >
          p.{cite.page}
        </sup>
      ) : (
        <sup
          key={`${m.index}-c`}
          title="The model referenced a source that was not returned with this answer — treat this sentence as unverified."
          className="ml-0.5 inline-flex -translate-y-px items-center rounded-[5px] bg-[#c98a2b]/12 px-1 py-px align-baseline text-[9.5px] font-semibold text-[#a8711f]"
        >
          unverified
        </sup>
      ),
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}


/** Citation titles are raw filenames; the extension is noise in a chip. */
function citationLabel(title: string): string {
  return title.replace(/\.pdf$/i, "");
}

/**
 * Extraction pulls every embedded raster off a cited page, which on a real
 * manual includes the page furniture -- the 57x57 wrench and info glyphs
 * Schneider prints beside each note. Presenting those under "Diagrams" is
 * worse than showing nothing, so anything too small to be a figure is
 * measured on load and dropped, and the section disappears if none survive.
 *
 * This is a display guard, not a fix: the real filter belongs in the
 * extractor (services/document-processor/app/pdf.py), which should not be
 * emitting icons in the first place.
 */
const MIN_DIAGRAM_PX = 130;

function Diagrams({ images }: { images: string[] }) {
  const [usable, setUsable] = useState<Record<number, boolean>>({});
  const candidates = images.slice(0, 6);
  const anyUsable = candidates.some((_, i) => usable[i]);

  return (
    <div className={cn("space-y-2.5", !anyUsable && "hidden")}>
      <SectionLabel>Diagrams from the manual</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        {candidates.map((img, i) => (
          <div
            key={i}
            className={cn(
              "overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-50 p-1.5",
              !usable[i] && "hidden",
            )}
          >
            <img
              src={img}
              alt=""
              className="w-full rounded-xl object-contain"
              style={{ maxHeight: 200 }}
              loading="lazy"
              onLoad={(e) => {
                const el = e.currentTarget;
                const big =
                  el.naturalWidth >= MIN_DIAGRAM_PX || el.naturalHeight >= MIN_DIAGRAM_PX;
                if (big) setUsable((prev) => (prev[i] ? prev : { ...prev, [i]: true }));
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

let _currentUtterance: SpeechSynthesisUtterance | null = null;
let _speakingIndex: number | null = null;
let _onStateChange: ((i: number | null) => void) | null = null;

export function speakText(text: string, index: number, onStateChange?: (i: number | null) => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  // If already speaking this bubble, stop
  if (_speakingIndex === index) {
    window.speechSynthesis.cancel();
    _currentUtterance = null;
    _speakingIndex = null;
    onStateChange?.(null);
    _onStateChange?.(null);
    return;
  }
  // Stop any ongoing speech
  window.speechSynthesis.cancel();
  _currentUtterance = null;
  _onStateChange?.(null);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.onend = () => {
    _speakingIndex = null;
    _currentUtterance = null;
    onStateChange?.(null);
  };
  utterance.onerror = () => {
    _speakingIndex = null;
    _currentUtterance = null;
    onStateChange?.(null);
  };
  _currentUtterance = utterance;
  _speakingIndex = index;
  _onStateChange = onStateChange ?? null;
  onStateChange?.(index);
  window.speechSynthesis.speak(utterance);
}

/**
 * The spoken form is the whole answer, not just the meaning -- a technician
 * with their hands inside a machine needs the steps read out, which is the
 * entire point of the button.
 */
function spokenForm(a: CitedAnswer): string {
  const parts: string[] = [];
  if (a.error_code) parts.push(`Error ${a.error_code}.`);
  if (a.meaning) parts.push(a.meaning);
  if (a.probable_causes.length) parts.push(`Probable causes. ${a.probable_causes.join(". ")}.`);
  if (a.corrective_action.length) {
    parts.push(
      `Corrective action. ${a.corrective_action.map((s) => `Step ${s.step}. ${s.action}`).join(" ")}`,
    );
  }
  if (!parts.length && a.refusals.length) parts.push(a.refusals.join(" "));
  return parts.join(" ");
}

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.role === "user";
  const a = message.structured;
  const [speaking, setSpeaking] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-neutral-950 px-4 py-2.5 text-[14px] leading-[1.55] tracking-[-0.01em] text-white sm:max-w-[75%]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Plain text reply (errors, network failures) -- no card chrome, it isn't an answer.
  if (!a) {
    return (
      <div className="max-w-[85%] rounded-[20px] rounded-bl-[6px] border border-neutral-200/80 bg-white px-4 py-3 text-[14px] leading-[1.6] text-neutral-700 sm:max-w-[75%]">
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    );
  }

  const confidence = CONFIDENCE_STYLE[a.confidence];

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(16,15,25,0.04),0_12px_32px_-12px_rgba(16,15,25,0.10)]">
        {/* Header — code, confidence, listen. Everything identifying, one row. */}
        <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-3 sm:px-7">
          {a.error_code ? (
            <span className="font-mono text-[13px] font-semibold tracking-[-0.01em] text-neutral-950">
              {a.error_code}
            </span>
          ) : (
            <span className="text-[13px] font-medium tracking-[-0.01em] text-neutral-950">Answer</span>
          )}
          <span className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", confidence.dot)} />
            <span className={cn("text-[11px] font-medium", confidence.text)}>
              {a.confidence} confidence
            </span>
          </span>
          <button
            onClick={() => speakText(spokenForm(a), index, (i) => setSpeaking(i === index))}
            className={cn(
              "ml-auto flex size-7 items-center justify-center rounded-full transition-colors",
              speaking
                ? "bg-[#359462]/10 text-[#2f7c53]"
                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900",
            )}
            title={speaking ? "Stop reading" : "Read answer aloud"}
          >
            {speaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
          {a.refusals.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#f0d9b8]/80 bg-[#fff8ef] px-4 py-3 text-[13px] leading-[1.55] text-[#8a5a1e]">
              <AlertCircle className="mt-px size-4 shrink-0" />
              <div className="space-y-1">
                {a.refusals.map((r, i) => (
                  <p key={i}>{r}</p>
                ))}
              </div>
            </div>
          )}

          {/* The lede. Deliberately the largest thing in the card. */}
          {a.meaning && (
            <p className="text-[17px] font-medium leading-[1.45] tracking-[-0.025em] text-[#17152A] sm:text-[19px]">
              <CitedText text={a.meaning} citations={a.citations} />
            </p>
          )}

          {a.probable_causes.length > 0 && (
            <div className="space-y-2.5">
              <SectionLabel>Probable causes</SectionLabel>
              <ul className="space-y-1.5">
                {a.probable_causes.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[14px] leading-[1.55] text-[#6D6878]"
                  >
                    <span className="mt-[9px] size-1 shrink-0 rounded-full bg-neutral-300" />
                    <span>
                      <CitedText text={c} citations={a.citations} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {a.corrective_action.length > 0 && (
            <div className="space-y-3">
              <SectionLabel>Corrective action</SectionLabel>
              {/* Numerals in a quiet gutter rather than coloured pucks: reads as
                  a procedure, and stays legible at any step count. */}
              <ol className="space-y-2.5">
                {a.corrective_action.map((s) => (
                  <li key={s.step} className="flex gap-3.5">
                    <span className="w-4 shrink-0 text-right text-[13px] font-semibold leading-[1.55] tabular-nums text-neutral-300">
                      {s.step}
                    </span>
                    <span className="text-[14px] leading-[1.55] text-[#3d3a49]">
                      <CitedText text={s.action} citations={a.citations} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {a.images && a.images.length > 0 && <Diagrams images={a.images} />}
        </div>

        {/* Citations live in a footer band: always present, never competing
            with the answer for attention, always findable. */}
        {a.citations.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-neutral-100 bg-neutral-50/70 px-5 py-3 sm:px-7">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Sources
            </span>
            {a.citations.map((c, i) => (
              <span
                key={i}
                title={c.section}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600"
              >
                <FileText className="size-3 text-neutral-400" />
                {citationLabel(c.title)}
                <span className="text-neutral-300">·</span>
                <span className="tabular-nums text-neutral-500">p.{c.page}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "E101 on the injection molding machine",
  "Why is the press overheating?",
  "E204 on the Press-2000",
  "b005 on powerflex",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [upload, setUpload] = useState<{ state: "idle" | "busy" | "done" | "error"; message: string }>(
    { state: "idle", message: "" },
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [useOcr, setUseOcr] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition is not supported in this browser."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const refreshStats = React.useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      /* stats are cosmetic — never break the chat over them */
    }
  }, []);

  React.useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Follow the conversation on every turn, not only when a request settles --
  // otherwise your own message can land below the fold as you send it.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const handleDelete = async (documentId: string, label: string) => {
    if (!confirm(`Delete "${label}"? This removes it from the index; re-upload to add it back.`)) return;
    setDeletingId(documentId);
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(documentId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUpload({ state: "error", message: data.error ?? `Delete failed (${res.status})` });
        return;
      }
      refreshStats();
    } catch (err) {
      setUpload({ state: "error", message: err instanceof Error ? err.message : "Delete failed" });
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * fetch() has no upload-progress event, so this uses XHR for the real
   * byte-transfer percentage (0-5%). Parsing + embedding happens server-side
   * and reports real progress through /api/ingest/progress, polled below.
   */
  const handleUpload = async (file: File) => {
    setUploadPct(0);
    setUpload({ state: "busy", message: `Uploading ${file.name}…` });
    const body = new FormData();
    body.set("file", file);
    if (useOcr) body.set("use_ocr", "true");

    // A dev-server reconnect (HMR), a proxy, or just a very long request can
    // drop the CLIENT's connection while the SERVER keeps working and
    // finishes the ingest anyway -- the exact "stuck at 95%, fine on reload"
    // report. `settled` makes whichever path resolves first (the XHR
    // response, or this poll noticing the document appear) win once, and
    // the poll is what makes the UI self-heal without a manual reload.
    let settled = false;
    const before = new Set((stats?.documents_list ?? []).map((d) => d.document_id));
    const finish = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      clearInterval(tick);
      clearInterval(poll);
      clearTimeout(giveUp);
      if (ok) setUploadPct(100);
      setUpload({ state: ok ? "done" : "error", message });
      if (ok) refreshStats();
    };

    // Real server-side progress, polled -- replaces the simulated bar that
    // ticked to 95% and parked there for however long the ingest actually
    // took (73s on a 172-page manual), which reads as "stuck" when it isn't.
    const jobId = crypto.randomUUID();
    body.set("job_id", jobId);
    let stageLabel = "Uploading";
    const tick = setInterval(async () => {
      try {
        const r = await fetch(`/api/ingest/progress?id=${jobId}`);
        if (!r.ok) return;
        const p = await r.json();
        if (typeof p.pct === "number" && p.pct > 0) setUploadPct(p.pct);
        if (p.stage && p.stage !== "unknown") {
          stageLabel = p.stage === "embedding" ? "Embedding" : p.stage === "parsing" ? "Parsing" : p.stage === "chunking" ? "Chunking" : p.stage === "indexing" ? "Indexing" : stageLabel;
          setUpload({ state: "busy", message: `${stageLabel} ${file.name}${p.detail ? ` — ${p.detail}` : ""}` });
        }
      } catch {
        /* transient poll failure is fine; next tick retries */
      }
    }, 1000);

    // Poll every 5s for a NEW document title matching this file -- catches
    // the case where the server finished but this tab never got told.
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data = await res.json();
        const found = (data.documents_list ?? []).find(
          (d: { document_id: string; title: string }) =>
            !before.has(d.document_id) && d.title === file.name,
        );
        if (found) {
          setStats(data);
          finish(true, `Indexed ${found.title}: ${found.pages} pages, ${found.chunks} chunks, ${found.faults ?? 0} fault codes.`);
        }
      } catch {
        /* poll failures are silent -- the XHR path or the next poll tick still covers it */
      }
    }, 5000);

    // 12 min ceiling: past this, stop pretending and say so plainly instead
    // of spinning forever.
    const giveUp = setTimeout(
      () => finish(false, "This upload is taking unusually long. Check the manuals list — it may have finished; if not, try again."),
      12 * 60 * 1000,
    );

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/ingest");

    // Byte-transfer share of the bar is small on purpose: the upload is
    // seconds, the server-side work is the rest.
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadPct(Math.min(5, Math.round((e.loaded / e.total) * 5)));
    };
    xhr.upload.onload = () => {
      setUpload({ state: "busy", message: `Parsing ${file.name}…` });
    };

    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* fall through to generic error below */
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        finish(false, (data.error as string) ?? `Upload failed (${xhr.status})`);
        return;
      }
      const lowText = Array.isArray(data.low_text_pages) ? (data.low_text_pages as number[]) : [];
      const warn = lowText.length ? ` ${lowText.length} page(s) had little/no extractable text (scanned?).` : "";
      finish(true, `Indexed ${data.title}: ${data.pages} pages, ${data.chunks} chunks, ${data.faults} fault codes.${warn}`);
    };

    xhr.onerror = () => {
      // A dropped connection is exactly what the poll is for -- don't
      // declare failure yet, let it keep checking rather than show a false
      // error for an upload that's actually still finishing server-side.
      setUpload({ state: "busy", message: `Connection interrupted — still checking on ${file.name}…` });
    };
    xhr.send(body);
  };

  const handleSubmit = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({
            role: m.role,
            content: m.structured ? summarizeForHistory(m.structured) : m.content,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        setMessages((prev) => [...prev, { role: "assistant", content: `Error (${res.status}): ${err.slice(0, 200)}` }]);
        return;
      }
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer.meaning || data.answer.refusals?.[0] || "", structured: data.answer },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Network error: ${err instanceof Error ? err.message : "Unknown"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const documents = stats?.documents_list ?? [];
  const hasManuals = (stats?.documents ?? 0) > 0;

  const pipelineStats = [
    { label: "Chunks", value: stats ? stats.chunks.toLocaleString() : "—" },
    { label: "Fault codes", value: stats ? String(stats.faults) : "—" },
    { label: "Vector dims", value: stats?.dims ? String(stats.dims) : "—" },
    { label: "Embedder", value: "Jina v3" },
  ];

  return (
    <div className="flex h-svh bg-neutral-50 font-sans text-neutral-950 antialiased">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-neutral-950/20 backdrop-blur-[2px] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ───────────────────────── Sidebar ───────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[19rem] flex-col border-r border-neutral-200/70 bg-white transition-transform duration-200 ease-out md:relative md:z-0 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-[9px] bg-neutral-950 text-[11px] font-bold text-white">
              F
            </div>
            <span className="text-[14px] font-semibold tracking-[-0.02em] text-neutral-950">
              FaultFinder
            </span>
            <ArrowUpRight className="size-3.5 text-neutral-300 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-500" />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="scroll-fade flex-1 space-y-7 overflow-y-auto px-4 pb-6">
          {/* Manuals */}
          <section>
            <div className="mb-2.5 flex items-baseline gap-2 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Manuals
              </p>
              <span className="ml-auto text-[11px] font-medium tabular-nums text-neutral-400">
                {stats?.documents ?? 0}
              </span>
            </div>

            <div className="space-y-1">
              {documents.length === 0 && (
                <p className="rounded-2xl border border-dashed border-neutral-200 px-3.5 py-3 text-[12px] leading-[1.5] text-neutral-400">
                  Nothing indexed yet. Upload a PDF manual to begin.
                </p>
              )}
              {documents.map((doc) => (
                <div
                  key={doc.document_id}
                  className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-neutral-50"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-neutral-100 text-neutral-500">
                    <FileText className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-900">
                      {doc.model || doc.title}
                    </p>
                    <p className="text-[11px] tabular-nums text-neutral-400">
                      {doc.pages} pages · {doc.chunks ?? "—"} chunks
                      {doc.faults ? ` · ${doc.faults} codes` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.document_id, doc.model || doc.title)}
                    disabled={deletingId === doc.document_id}
                    title="Delete manual"
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-neutral-300 opacity-0 transition hover:bg-[#c64e27]/10 hover:text-[#c64e27] focus-visible:opacity-100 disabled:opacity-100 group-hover:opacity-100"
                  >
                    {deletingId === doc.document_id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            <label
              className={cn(
                "mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-dashed px-3 py-3 text-[12px] font-medium transition",
                upload.state === "busy"
                  ? "cursor-wait border-neutral-200 bg-neutral-50 text-neutral-400"
                  : "border-neutral-300 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950",
              )}
            >
              {upload.state === "busy" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {upload.state === "busy" ? "Indexing…" : "Upload PDF manual"}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={upload.state === "busy"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleUpload(file);
                }}
              />
            </label>

            <label className="mt-2 flex cursor-pointer select-none items-center justify-center gap-1.5 text-[10px] leading-[1.4] text-neutral-400">
              <input
                type="checkbox"
                checked={useOcr}
                onChange={(e) => setUseOcr(e.target.checked)}
                disabled={upload.state === "busy"}
                className="size-3 rounded border-neutral-300 accent-neutral-950"
              />
              <span>OCR scanned pages (slower)</span>
            </label>

            {upload.state !== "idle" && (
              <div className="mt-3 space-y-2">
                {upload.state === "busy" && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full rounded-full bg-neutral-950 transition-[width] duration-500 ease-out"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-2xl px-3 py-2.5 text-[11px] leading-[1.5]",
                    upload.state === "error"
                      ? "bg-[#c64e27]/10 text-[#a8401f]"
                      : upload.state === "done"
                        ? "bg-[#359462]/10 text-[#2f7c53]"
                        : "bg-neutral-100 text-neutral-600",
                  )}
                >
                  {upload.state === "done" && <CheckCircle2 className="mt-px size-3.5 shrink-0" />}
                  {upload.state === "error" && <AlertCircle className="mt-px size-3.5 shrink-0" />}
                  {upload.state === "busy" && <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" />}
                  <span className={upload.state === "busy" ? "shimmer" : undefined}>
                    {upload.message}
                    {upload.state === "busy" && ` (${uploadPct}%)`}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Pipeline — a definition list, not four boxes. */}
          <section>
            <p className="mb-2.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Pipeline
            </p>
            <dl className="overflow-hidden rounded-2xl border border-neutral-200/70">
              {pipelineStats.map((s, i) => (
                <div
                  key={s.label}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-2.5",
                    i > 0 && "border-t border-neutral-100",
                  )}
                >
                  <dt className="text-[12px] text-neutral-500">{s.label}</dt>
                  <dd className="text-[12px] font-semibold tabular-nums tracking-[-0.01em] text-neutral-900">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Setup — kept, but folded away so it never competes with the work. */}
          <section>
            <details className="group rounded-2xl border border-neutral-200/70 px-3.5 py-2.5">
              <summary className="cursor-pointer list-none text-[11px] font-medium text-neutral-500 transition-colors hover:text-neutral-900">
                Setup &amp; troubleshooting
                <span className="float-right text-neutral-300 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="mt-3 space-y-2 text-[11px] leading-[1.6] text-neutral-500">
                <p>
                  Requires the parser at <code className="rounded bg-neutral-100 px-1 py-px font-mono text-[10px]">:8080</code>{" "}
                  plus <code className="rounded bg-neutral-100 px-1 py-px font-mono text-[10px]">JINA_API_KEY</code> and{" "}
                  <code className="rounded bg-neutral-100 px-1 py-px font-mono text-[10px]">GROQ_API_KEY</code> in{" "}
                  <code className="rounded bg-neutral-100 px-1 py-px font-mono text-[10px]">apps/web/.env.local</code>.
                </p>
                <p>
                  An upload that misbehaves can be deleted and re-uploaded — embeddings are cached, so
                  the second pass takes seconds.
                </p>
              </div>
            </details>
          </section>
        </div>
      </aside>

      {/* ───────────────────────── Main ───────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[57px] shrink-0 items-center justify-between border-b border-neutral-200/70 bg-neutral-50/80 px-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 md:hidden"
            >
              <Menu className="size-4" />
            </button>
            <p className="text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
              Ask FaultFinder
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-400">
            <span
              className={cn("size-1.5 rounded-full", hasManuals ? "bg-[#359462]" : "bg-neutral-300")}
            />
            <span className="tabular-nums">
              {stats?.documents ?? 0} {stats?.documents === 1 ? "manual" : "manuals"} ·{" "}
              {(stats?.chunks ?? 0).toLocaleString()} chunks
            </span>
          </div>
        </header>

        <div className="scroll-fade flex-1 overflow-y-auto px-5">
          <div className="mx-auto max-w-[46rem] space-y-6 py-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center px-2 pt-[10vh] text-center">
                <h1 className="max-w-[20rem] text-[2rem] font-medium leading-[1.05] tracking-[-0.04em] text-neutral-950 sm:max-w-lg sm:text-[2.75rem] sm:tracking-[-0.045em]">
                  Turn a cryptic error code into a fix.
                </h1>
                <p className="mt-4 max-w-[24rem] text-[14px] font-medium leading-[1.55] tracking-[-0.02em] text-[#6D6878] sm:text-[15px]">
                  Type an error code, a symptom, or a machine name. Every answer comes back with the
                  meaning, the probable cause, and cited repair steps.
                </p>

                {!hasManuals ? (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-9 inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-6 text-[14px] font-semibold text-white transition-colors hover:bg-neutral-800"
                    >
                      <Upload className="size-4" />
                      Upload a PDF manual
                    </button>
                    <p className="mt-3 text-[12px] text-neutral-400">
                      Nothing is preloaded — the index starts empty by design.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {[
                        { label: "Manuals", value: (stats?.documents ?? 0).toLocaleString() },
                        { label: "Chunks", value: (stats?.chunks ?? 0).toLocaleString() },
                        { label: "Codes", value: (stats?.faults ?? 0).toLocaleString() },
                        // A vector dimension is not a quantity — never comma-grouped.
                        { label: "Dims", value: String(stats?.dims ?? 0) },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-2xl border border-neutral-200/70 bg-white px-3 py-3 text-left"
                        >
                          <p className="text-[19px] font-medium tabular-nums leading-none tracking-[-0.03em] text-neutral-950">
                            {s.value}
                          </p>
                          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Stacked on a narrow screen so four pills of different
                        widths don't read as scattered debris. */}
                    <div className="mt-8 flex w-full max-w-lg flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                      {SUGGESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSubmit(q)}
                          className="rounded-full border border-neutral-200/80 bg-white px-3.5 py-2 text-[12.5px] font-medium tracking-[-0.01em] text-neutral-600 transition-colors hover:border-neutral-950 hover:text-neutral-950"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} index={i} />
            ))}

            {loading && (
              <div className="flex items-center gap-2.5 text-[13px] font-medium text-neutral-500">
                <Loader2 className="size-3.5 animate-spin text-neutral-400" />
                <span className="shimmer">Searching the manuals…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Composer: one surface, actions inside it. ── */}
        <div className="shrink-0 px-5 pb-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(input);
            }}
            className="mx-auto max-w-[46rem]"
          >
            <div className="rounded-[26px] border border-neutral-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(16,15,25,0.04),0_16px_40px_-16px_rgba(16,15,25,0.14)] transition-colors focus-within:border-neutral-400">
              <textarea
                ref={textareaRef}
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Grow with the content, up to ~6 lines, then scroll.
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 168)}px`;
                }}
                // Implicit form submission doesn't fire for a textarea, so
                // Enter is wired explicitly — Shift+Enter still inserts a newline.
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSubmit(input);
                  }
                }}
                placeholder={
                  hasManuals
                    ? "e.g. E101 on the injection molding machine"
                    : "Upload a manual first, then ask anything about it"
                }
                disabled={loading}
                className="max-h-[168px] w-full resize-none bg-transparent px-3 pb-1 pt-2 text-[14.5px] leading-[1.55] tracking-[-0.01em] text-neutral-950 placeholder:text-neutral-400 focus:outline-none disabled:opacity-50"
              />
              <div className="flex items-center gap-1.5 px-1 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={upload.state === "busy"}
                  title="Upload a PDF manual"
                  className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={startListening}
                  disabled={loading || listening}
                  title="Voice input"
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full transition-colors",
                    listening
                      ? "bg-[#c64e27] text-white"
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700",
                  )}
                >
                  <Mic className={cn("size-4", listening && "animate-pulse")} />
                </button>

                <span className="ml-auto hidden pr-1 text-[10.5px] text-neutral-300 sm:block">
                  Enter to send · Shift+Enter for a new line
                </span>

                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition-all hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </button>
              </div>
            </div>
          </form>
          <p className="mt-2.5 text-center text-[10.5px] text-neutral-400">
            Answers are retrieved from your loaded manuals and cited by page. Verify before acting on
            live equipment.
          </p>
        </div>
      </div>
    </div>
  );
}
