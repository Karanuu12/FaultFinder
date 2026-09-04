"use client";

import React, { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Bot,
  CircleAlert,
  FileText,
  Loader2,
  Search,
  Upload,
  User,
  Wrench,
  Files,
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const a = message.structured;

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm",
          isUser
            ? "bg-neutral-900 text-white"
            : "bg-emerald-100 text-emerald-700",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm bg-neutral-900 text-white"
            : "rounded-bl-sm border border-neutral-200/70 bg-white text-neutral-800",
        )}
      >
        {/* Plain text fallback */}
        {!a && <p className="whitespace-pre-wrap">{message.content}</p>}

        {/* Structured answer */}
        {a && (
          <div className="space-y-4">
            {/* Refusal */}
            {a.refusals.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div>
                  {a.refusals.map((r, i) => (
                    <p key={i} className="text-sm font-medium">
                      {r}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {a.error_code && (
              <div>
                <span className="inline-block rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs font-bold text-neutral-700">
                  {a.error_code}
                </span>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Meaning
              </p>
              <p className="mt-1 font-medium">{a.meaning}</p>
            </div>

            {a.probable_causes.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <Search className="size-3" /> Probable Causes
                </div>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-neutral-700">
                  {a.probable_causes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {a.corrective_action.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <Wrench className="size-3" /> Corrective Action
                </div>
                <ol className="mt-1.5 list-inside list-decimal space-y-1 text-sm text-neutral-700">
                  {a.corrective_action.map((s) => (
                    <li key={s.step}>{s.action}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Citations */}
            {a.citations.length > 0 && (
              <div className="border-t border-neutral-100 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <FileText className="size-3" /> Sources
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {a.citations.map((c, i) => (
                    <span
                      key={i}
                      className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-600"
                      title={c.document_id}
                    >
                      {c.title} · p{c.page}
                      {c.section ? ` · ${c.section.slice(0, 30)}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Images from the source page */}
            {a.images && a.images.length > 0 && (
              <div className="border-t border-neutral-100 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Diagrams
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {a.images.slice(0, 4).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`Diagram from source page`}
                      className="rounded-lg border border-neutral-200 object-contain"
                      style={{ maxHeight: 200 }}
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Confidence badge */}
            <div className="flex items-center gap-2 text-[10px] font-medium text-neutral-400">
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  a.confidence === "high"
                    ? "bg-emerald-100 text-emerald-700"
                    : a.confidence === "medium"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700",
                )}
              >
                {a.confidence} confidence
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestedQueries({ onSelect }: { onSelect: (q: string) => void }) {
  const suggestions = [
    "E101 on the injection molding machine",
    "Why is the press overheating?",
    "E204 on the Press-2000",
    "What does E101 mean?",
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-4">
      <span className="text-xs font-medium text-neutral-400">Try:</span>
      {suggestions.map((q) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className="cursor-pointer rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs font-medium text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-700"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

interface IndexStats {
  documents: number;
  chunks: number;
  faults: number;
  dims: number;
  machines: string[];
  documents_list?: { document_id: string; title: string; model?: string; pages: number }[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [upload, setUpload] = useState<{
    state: "idle" | "busy" | "done" | "error";
    message: string;
  }>({ state: "idle", message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const handleUpload = async (file: File) => {
    setUpload({ state: "busy", message: `Parsing and indexing ${file.name}…` });
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setUpload({ state: "error", message: data.error ?? `Upload failed (${res.status})` });
        return;
      }
      setUpload({
        state: "done",
        message: `Indexed ${data.title}: ${data.pages} pages, ${data.chunks} chunks, ${data.faults} fault codes.`,
      });
      refreshStats();
    } catch (err) {
      setUpload({
        state: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSubmit = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
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
            content: m.structured ? JSON.stringify(m.structured) : m.content,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error (${res.status}): ${err.slice(0, 200)}`,
          },
        ]);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer.meaning || data.answer.refusals[0] || "",
          structured: data.answer,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Network error: ${err instanceof Error ? err.message : "Unknown"}`,
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  return (
    <div className="flex min-h-svh flex-col bg-neutral-50 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">
            T
          </div>
          <span className="text-sm font-semibold text-neutral-800">
            FaultFinder
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-neutral-400">
            RAG Troubleshooting
          </span>
          <label
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              upload.state === "busy"
                ? "cursor-wait border-neutral-200 bg-neutral-100 text-neutral-400"
                : "cursor-pointer border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800",
            )}
          >
            {upload.state === "busy" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {upload.state === "busy" ? "Indexing…" : "Upload PDF"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={upload.state === "busy"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset so re-selecting the same file fires change again.
                e.target.value = "";
                if (file) handleUpload(file);
              }}
            />
          </label>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 pt-20 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100">
                <Bot className="size-6 text-emerald-600" />
              </div>
              <h1 className="text-xl font-semibold text-neutral-800">
                Ask FaultFinder
              </h1>
              <p className="max-w-md text-sm text-neutral-500">
                Type an error code, a symptom, or a machine name. Get a cited
                answer from the loaded manuals.
              </p>

              {/* Live index stats — read from /api/stats, not hardcoded */}
              <div className="mt-4 grid grid-cols-2 gap-3 w-full max-w-md">
                <div className="rounded-xl border border-neutral-200 bg-white p-3 text-left">
                  <div className="flex items-center gap-2">
                    <Files className="size-4 text-neutral-400 shrink-0" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Manuals</p>
                  </div>
                  <p className="mt-1 text-lg font-bold text-neutral-900">{stats?.documents ?? "—"}</p>
                  <p className="text-[10px] text-neutral-500">
                    {stats?.documents_list?.length
                      ? stats.documents_list.map((d) => d.model || d.title).join(", ")
                      : "Upload a PDF manual to index it"}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-3 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Chunks Indexed</p>
                  <p className="mt-0.5 text-lg font-bold text-neutral-900">{stats?.chunks ?? "—"}</p>
                  <p className="text-[10px] text-neutral-500">Structure-aware, with page/section metadata</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-3 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Fault Codes</p>
                  <p className="mt-0.5 text-lg font-bold text-neutral-900">{stats?.faults ?? "—"}</p>
                  <p className="text-[10px] text-neutral-500">Code → meaning → cause → corrective action</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-3 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Vector Dims</p>
                  <p className="mt-0.5 text-lg font-bold text-neutral-900">{stats?.dims || "—"}</p>
                  <p className="text-[10px] text-neutral-500">jina-embeddings-v3 (hosted, multilingual)</p>
                </div>
              </div>

              {upload.state !== "idle" && (
                <div
                  className={cn(
                    "mt-1 w-full max-w-md rounded-lg px-3 py-2 text-left text-xs",
                    upload.state === "error"
                      ? "bg-red-50 text-red-700"
                      : upload.state === "done"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-600",
                  )}
                >
                  {upload.message}
                </div>
              )}

              <SuggestedQueries onSelect={handleSubmit} />
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <Loader2 className="size-4 animate-spin" />
              Searching manuals...
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 bg-white px-4 py-4">
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <div className="relative flex-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              // Implicit form submission does not fire for this input (the
              // submit event never reaches the form), so Enter is wired
              // explicitly. Without this, typing a query and pressing Enter
              // silently does nothing and the send button looks dead.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSubmit(input);
                }
              }}
              placeholder="e.g. E101 on the injection molding machine"
              disabled={loading}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || loading}
            size="icon"
            className="size-10 shrink-0 rounded-full bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
        <p className="mt-2 text-center text-[10px] text-neutral-400">
          Answers are sourced from loaded manuals. Verify before acting.
        </p>
      </div>
    </div>
  );
}