"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Bot,
  Loader2,
  Upload,
  User,
  File,
  Menu,
  X,
  BookOpen,
  Database,
  Layers,
  Hash,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Sparkles,
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

const CONFIDENCE_STYLE: Record<CitedAnswer["confidence"], string> = {
  high: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
  medium: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
  low: "bg-red-50 text-red-600 ring-1 ring-red-100",
};

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const a = message.structured;

  return (
    <div className={cn("flex items-start gap-3", isUser ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl text-sm",
          isUser ? "bg-neutral-900 text-white" : "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      {isUser ? (
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ) : (
        <div className="max-w-[75%] space-y-3">
          {!a && (
            <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-3.5 text-sm leading-relaxed text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          )}

          {a && (
            <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
              <div className="space-y-4 px-5 py-4">
                {a.refusals.length > 0 && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div className="space-y-1">
                      {a.refusals.map((r, i) => (
                        <p key={i}>{r}</p>
                      ))}
                    </div>
                  </div>
                )}

                {(a.error_code || a.meaning) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {a.error_code && (
                      <span className="rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs font-semibold text-neutral-600">
                        {a.error_code}
                      </span>
                    )}
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", CONFIDENCE_STYLE[a.confidence])}>
                      {a.confidence} confidence
                    </span>
                  </div>
                )}

                {a.meaning && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Meaning</p>
                    <p className="text-[15px] font-medium leading-relaxed text-neutral-900">{a.meaning}</p>
                  </div>
                )}

                {a.probable_causes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Probable Causes</p>
                    <ul className="space-y-1.5">
                      {a.probable_causes.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-300" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {a.corrective_action.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Corrective Action</p>
                    <ol className="space-y-2">
                      {a.corrective_action.map((s) => (
                        <li key={s.step} className="flex items-start gap-2.5 text-sm text-neutral-600">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-600">
                            {s.step}
                          </span>
                          {s.action}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {a.citations.length > 0 && (
                  <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Sources</p>
                    <div className="flex flex-wrap gap-1.5">
                      {a.citations.map((c, i) => (
                        <span
                          key={i}
                          title={c.section}
                          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-500"
                        >
                          <File className="size-3" />
                          {c.title} · p{c.page}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {a.images && a.images.length > 0 && (
                  <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Diagrams</p>
                    <div className="grid grid-cols-2 gap-2">
                      {a.images.slice(0, 4).map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt=""
                          className="rounded-xl border border-neutral-200/80"
                          style={{ maxHeight: 160 }}
                          loading="lazy"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
   * byte-transfer percentage (0-60%). Parsing + embedding happens
   * server-side after the transfer completes with no granular signal back,
   * so 60-95% is a slow simulated tick while waiting -- honest about being
   * two different kinds of progress, not a fake full-request bar.
   */
  const handleUpload = async (file: File) => {
    setUploadPct(0);
    setUpload({ state: "busy", message: `Uploading ${file.name}…` });
    const body = new FormData();
    body.set("file", file);

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
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const documents = stats?.documents_list ?? [];
  const hasManuals = (stats?.documents ?? 0) > 0;

  const pipelineStats = [
    { label: "Chunks", value: stats ? String(stats.chunks) : "—", icon: Layers },
    { label: "Fault Codes", value: stats ? String(stats.faults) : "—", icon: Hash },
    { label: "Vector Dims", value: stats?.dims ? String(stats.dims) : "—", icon: Database },
    { label: "Embedder", value: "Jina v3", icon: Sparkles },
  ];

  return (
    <div className="flex h-svh bg-neutral-50 font-sans">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-neutral-200/70 bg-white transition-transform duration-200 md:relative md:z-0 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-neutral-900 text-xs font-bold text-white">
              F
            </div>
            <span className="text-sm font-semibold text-neutral-900">FaultFinder</span>
          </a>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {/* Manuals */}
          <div>
            <div className="mb-3 flex items-center gap-2 px-1">
              <BookOpen className="size-3.5 text-neutral-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Manuals</p>
              <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                {stats?.documents ?? 0}
              </span>
            </div>

            <div className="space-y-0.5">
              {documents.length === 0 && (
                <p className="px-3 py-2 text-[12px] text-neutral-400">No manuals indexed yet.</p>
              )}
              {documents.map((doc) => (
                <div
                  key={doc.document_id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-neutral-50"
                >
                  <File className="size-4 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-800">{doc.model || doc.title}</p>
                    <p className="text-[10px] text-neutral-400">
                      {doc.pages}p · {doc.chunks ?? "—"}c{doc.faults ? ` · ${doc.faults} codes` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.document_id, doc.model || doc.title)}
                    disabled={deletingId === doc.document_id}
                    title="Delete manual"
                    className="flex size-6 shrink-0 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
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
                "mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2.5 text-[12px] font-medium transition",
                upload.state === "busy"
                  ? "cursor-wait border-neutral-200 bg-neutral-50 text-neutral-400"
                  : "border-neutral-300 text-neutral-500 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700",
              )}
            >
              {upload.state === "busy" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
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

            {upload.state !== "idle" && (
              <div className="mt-2 space-y-1.5">
                {upload.state === "busy" && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-snug",
                    upload.state === "error"
                      ? "bg-red-50 text-red-700"
                      : upload.state === "done"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-600",
                  )}
                >
                  {upload.state === "done" && <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />}
                  {upload.state === "error" && <AlertCircle className="mt-0.5 size-3.5 shrink-0" />}
                  {upload.state === "busy" && <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />}
                  <span>
                    {upload.message}
                    {upload.state === "busy" && ` (${uploadPct}%)`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="border-t border-neutral-100 pt-4">
            <div className="mb-3 flex items-center gap-2 px-1">
              <Database className="size-3.5 text-neutral-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Pipeline</p>
            </div>
            <div className="space-y-2">
              {pipelineStats.map((s) => (
                <div key={s.label} className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2">
                  <s.icon className="size-4 shrink-0 text-neutral-400" />
                  <div className="flex w-full items-center justify-between">
                    <p className="text-[10px] font-medium text-neutral-500">{s.label}</p>
                    <p className="text-[12px] font-semibold text-neutral-800">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200/70 bg-white/80 px-5 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 md:hidden"
            >
              <Menu className="size-4" />
            </button>
            <div className="flex size-8 items-center justify-center rounded-xl bg-neutral-900 text-xs font-bold text-white md:hidden">
              F
            </div>
            <p className="text-sm font-semibold text-neutral-900">Ask FaultFinder</p>
          </div>
          <div className="hidden items-center gap-2 text-[11px] font-medium text-neutral-400 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {stats?.documents ?? 0} manuals · {stats?.chunks ?? 0} chunks indexed
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center pt-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Bot className="size-7 text-white" />
                </div>
                <h1 className="mt-5 text-2xl font-medium text-neutral-900">Ask FaultFinder</h1>
                <p className="mt-1.5 max-w-sm text-sm text-neutral-400">
                  Type an error code, a symptom, or a machine name. Get a cited answer from the correct manual.
                </p>

                {!hasManuals ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-8 flex items-center gap-2 rounded-full border border-dashed border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-500 transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700"
                  >
                    <Upload className="size-4" />
                    Upload a PDF manual to get started
                  </button>
                ) : (
                  <>
                    <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
                      {[
                        { label: "Manuals", value: stats?.documents ?? 0, sub: "indexed" },
                        { label: "Chunks", value: stats?.chunks ?? 0, sub: "structured" },
                        { label: "Fault Codes", value: stats?.faults ?? 0, sub: "extracted" },
                        { label: "Vector Dims", value: stats?.dims ?? 0, sub: "jina v3" },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-2xl border border-neutral-200/70 bg-white px-4 py-3.5 text-left shadow-sm"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{s.label}</p>
                          <p className="mt-0.5 text-xl font-bold text-neutral-900">{s.value}</p>
                          <p className="text-[10px] text-neutral-400">{s.sub}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 flex flex-wrap justify-center gap-2">
                      <span className="text-xs font-medium text-neutral-400">Try:</span>
                      {SUGGESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSubmit(q)}
                          className="cursor-pointer rounded-full border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:border-emerald-300 hover:text-emerald-700"
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
              <MessageBubble key={i} message={msg} />
            ))}
            {loading && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-neutral-200/70 bg-white px-5 py-3.5 text-sm text-neutral-500 shadow-sm">
                <Loader2 className="size-4 animate-spin text-emerald-500" />
                Searching manuals...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-neutral-200/70 bg-white/90 px-5 py-4 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(input);
            }}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              // Implicit form submission doesn't reliably fire for this input,
              // so Enter is wired explicitly — without this, typing a query
              // and pressing Enter can silently do nothing.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSubmit(input);
                }
              }}
              placeholder="e.g. E101 on the injection molding machine"
              disabled={loading}
              className="flex-1 rounded-2xl border border-neutral-200/80 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm transition hover:bg-neutral-700 disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-neutral-400">
            Answers are sourced from loaded manuals. Verify before acting.
          </p>
        </div>
      </div>
    </div>
  );
}
