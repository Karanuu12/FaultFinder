"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, Bot, FileText, Loader2, Search, Upload, User, Wrench, File, Menu, X, BookOpen, Database, Layers, Cpu } from "lucide-react";

interface Citation { document_id: string; title: string; page: number; section: string; }
interface AnswerStep { step: number; action: string; }
interface CitedAnswer { error_code?: string; meaning: string; probable_causes: string[]; corrective_action: AnswerStep[]; citations: Citation[]; images?: string[]; confidence: "high" | "medium" | "low"; refusals: string[]; }
interface ChatMessage { role: "user" | "assistant"; content: string; structured?: CitedAnswer; }

const MANUAL_FILES = [
  { name: "RoboInject-300", pages: 4, chunks: 17 },
  { name: "Press-2000", pages: 3, chunks: 16 },
  { name: "Press-2001", pages: 3, chunks: 14 },
  { name: "ISO-9001 Safety", pages: 3, chunks: 9 },
  { name: "PowerFlex-525", pages: 4, chunks: 25 },
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const a = message.structured;

  return (
    <div className={cn("flex gap-3 items-start", isUser ? "flex-row-reverse" : "")}>
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl text-sm", isUser ? "bg-neutral-900 text-white" : "bg-emerald-50 text-emerald-500")}>
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      {isUser ? (
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-2.5 text-sm leading-relaxed text-white">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ) : (
        <div className="max-w-[75%] space-y-3">
          {!a && (
            <div className="rounded-2xl border border-neutral-200/80 bg-white px-5 py-3.5 text-sm leading-relaxed text-neutral-700 shadow-sm">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          )}

          {a && (
            <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
              <div className="px-5 py-4 space-y-4">
                {a.refusals.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
                    {a.refusals.map((r, i) => <p key={i}>{r}</p>)}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {a.error_code && <span className="rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs font-semibold text-neutral-600">{a.error_code}</span>}
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", a.confidence === "high" ? "bg-emerald-50 text-emerald-600" : a.confidence === "medium" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600")}>{a.confidence}</span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Meaning</p>
                  <p className="text-sm font-medium text-neutral-900 leading-relaxed">{a.meaning}</p>
                </div>

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
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-500">{s.step}</span>
                          {s.action}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {a.citations.length > 0 && (
                  <div className="border-t border-neutral-100 pt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Sources</p>
                    <div className="flex flex-wrap gap-1.5">
                      {a.citations.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-500"><File className="size-3" />{c.title} · p{c.page}</span>
                      ))}
                    </div>
                  </div>
                )}

                {a.images && a.images.length > 0 && (
                  <div className="border-t border-neutral-100 pt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Diagrams</p>
                    <div className="grid grid-cols-2 gap-2">
                      {a.images.slice(0, 4).map((img, i) => <img key={i} src={img} alt="" className="rounded-xl border border-neutral-200/80" style={{ maxHeight: 160 }} loading="lazy" />)}
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

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages.map((m) => ({ role: m.role, content: m.structured ? JSON.stringify(m.structured) : m.content })) }) });
      if (!res.ok) { const err = await res.text(); setMessages((prev) => [...prev, { role: "assistant", content: `Error (${res.status}): ${err.slice(0, 200)}` }]); return; }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer.meaning || data.answer.refusals[0] || "", structured: data.answer }]);
    } catch (err) { setMessages((prev) => [...prev, { role: "assistant", content: `Network error: ${err instanceof Error ? err.message : "Unknown"}` }]); }
    finally { setLoading(false); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }
  };

  return (
    <div className="flex h-svh bg-neutral-50 font-sans">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-neutral-200/80 bg-white transition-transform duration-200 md:relative md:z-0 md:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-neutral-900 text-xs font-bold text-white">T</div>
            <span className="text-sm font-semibold text-neutral-900">FaultFinder</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 md:hidden"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3 px-1"><BookOpen className="size-3.5 text-neutral-400" /><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Manuals</p><span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">{MANUAL_FILES.length}</span></div>
            <div className="space-y-0.5">
              {MANUAL_FILES.map((file) => (
                <div key={file.name} className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-neutral-50">
                  <File className="size-4 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-800">{file.name}</p>
                    <p className="text-[10px] text-neutral-400">{file.pages}p · {file.chunks}c</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-neutral-100 pt-4">
            <div className="flex items-center gap-2 mb-3 px-1"><Database className="size-3.5 text-neutral-400" /><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Pipeline</p></div>
            <div className="space-y-2">
              {[{ label: "Chunks", value: "81", icon: Layers }, { label: "Dims", value: "768", icon: Cpu }, { label: "DB", value: "Qdrant", icon: Database }, { label: "Model", value: "Ollama", icon: Cpu }].map((s) => (
                <div key={s.label} className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2">
                  <s.icon className="size-4 shrink-0 text-neutral-400" />
                  <div className="flex w-full items-center justify-between"><p className="text-[10px] font-medium text-neutral-500">{s.label}</p><p className="text-[12px] font-semibold text-neutral-800">{s.value}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200/80 bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 md:hidden"><Menu className="size-4" /></button>
            <div className="flex size-8 items-center justify-center rounded-xl bg-neutral-900 text-xs font-bold text-white">T</div>
            <p className="text-sm font-semibold text-neutral-900">FaultFinder</p>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-4 py-2 text-xs font-medium text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-700"><Upload className="size-3.5" />Upload PDF<input type="file" accept=".pdf" className="hidden" disabled /></label>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center pt-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50"><Bot className="size-7 text-emerald-500" /></div>
                <h1 className="mt-5 text-2xl font-medium text-neutral-900">Ask FaultFinder</h1>
                <p className="mt-1.5 max-w-sm text-sm text-neutral-400">Type an error code, a symptom, or a machine name. Get a cited answer from the correct manual.</p>
                <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
                  {[{ label: "Files", value: "5", sub: "manuals" }, { label: "Chunks", value: "81", sub: "indexed" }, { label: "Dims", value: "768", sub: "vector" }, { label: "DB", value: "Qdrant", sub: "cosine" }].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-3.5 text-left shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{s.label}</p><p className="mt-0.5 text-xl font-bold text-neutral-900">{s.value}</p><p className="text-[10px] text-neutral-400">{s.sub}</p></div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  <span className="text-xs font-medium text-neutral-400">Try:</span>
                  {["E101 on the injection molding machine", "Why is the press overheating?", "E204 on the Press-2000", "b005 on powerflex"].map((q) => (
                    <button key={q} onClick={() => handleSubmit(q)} className="cursor-pointer rounded-full border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-700">{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
            {loading && <div className="flex items-center gap-2.5 rounded-2xl border border-neutral-200/80 bg-white px-5 py-3.5 text-sm text-neutral-500 shadow-sm"><Loader2 className="size-4 animate-spin text-emerald-500" />Searching manuals...</div>}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-neutral-200/80 bg-white px-5 py-4">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }} className="mx-auto flex max-w-3xl items-end gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. E101 on the injection molding machine" disabled={loading} className="flex-1 rounded-2xl border border-neutral-200/80 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-50" />
            <button type="submit" disabled={!input.trim() || loading} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:opacity-40"><ArrowUp className="size-4" /></button>
          </form>
          <p className="mt-2 text-center text-[10px] text-neutral-400">Answers are sourced from loaded manuals. Verify before acting.</p>
        </div>
      </div>
    </div>
  );
}