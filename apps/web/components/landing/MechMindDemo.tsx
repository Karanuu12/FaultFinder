"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Upload,
  Search,
  Brain,
  Database,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  FileSearch,
  Sparkles,
  Shield,
  Cpu,
  Zap,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

type DemoStep =
  | "upload"
  | "scan"
  | "understand"
  | "ask"
  | "retrieve"
  | "answer"
  | "ready"
  | "reset";

const WORKFLOW_STEPS = [
  { id: "upload", label: "Upload", short: "01" },
  { id: "scan", label: "Scan", short: "02" },
  { id: "understand", label: "Understand", short: "03" },
  { id: "ask", label: "Ask", short: "04" },
  { id: "retrieve", label: "Retrieve", short: "05" },
  { id: "answer", label: "Answer", short: "06" },
] as const;

const DEMO_MANUAL = {
  name: "CNC-200 Pro Service Manual.pdf",
  pages: 48,
  size: "12.4 MB",
};

const DEMO_QUESTION =
  "My CNC-200 Pro is showing error code E101. What does it mean and what should I check?";

const DEMO_SOURCES = [
  { title: "E101 — Emergency Circuit Fault", page: 42, highlight: true },
  { title: "Emergency Circuit", page: 42, highlight: false },
  { title: "Safety Relay Procedure", page: 43, highlight: false },
];

const DEMO_ANSWER_STEPS = [
  "Check that all emergency-stop buttons are released",
  "Inspect the safety relay status",
  "Check the emergency circuit connections",
  "Reset the safety circuit per manual procedure",
];

const WORKFLOW_TIMINGS: Record<string, number> = {
  upload: 4000,
  scan: 4000,
  understand: 4000,
  ask: 5000,
  retrieve: 5000,
  answer: 7000,
  ready: 2000,
  reset: 800,
};

function stepToIndex(step: DemoStep): number {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.id === step);
  return idx >= 0 ? idx : 0;
}

function WorkflowBar({ currentStep }: { currentStep: DemoStep }) {
  const activeIdx = stepToIndex(currentStep);
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-3 px-3">
      {WORKFLOW_STEPS.map((step, i) => {
        const isActive = i === activeIdx;
        const isComplete = i < activeIdx;
        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] sm:text-[14px] font-medium transition-all duration-500 ${
                isActive
                  ? "bg-blue-500/20 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                  : isComplete
                    ? "bg-emerald-500/10 text-emerald-400/70"
                    : "text-neutral-600"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="size-3.5 sm:size-4" />
              ) : (
                <span className="font-mono">{step.short}</span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <div
                className={`h-px w-2 sm:w-4 transition-colors duration-500 ${
                  i < activeIdx ? "bg-emerald-500/40" : "bg-neutral-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PdfCard({ selected, scanned }: { selected: boolean; scanned: boolean }) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition-all duration-500 ${
        scanned
          ? "border-emerald-500/30 bg-emerald-500/5"
          : selected
            ? "border-blue-500/30 bg-blue-500/5"
            : "border-neutral-700/50 bg-neutral-800/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex size-12 items-center justify-center rounded-lg transition-colors duration-300 ${
            scanned
              ? "bg-emerald-500/20"
              : selected
                ? "bg-blue-500/20"
                : "bg-neutral-700/50"
          }`}
        >
          <FileText
            className={`size-5 ${
              scanned
                ? "text-emerald-400"
                : selected
                  ? "text-blue-400"
                  : "text-neutral-400"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white">
            {DEMO_MANUAL.name}
          </p>
          <p className="text-[15px] text-neutral-500">
            PDF &bull; {DEMO_MANUAL.pages} pages &bull; {DEMO_MANUAL.size}
          </p>
        </div>
        {(selected || scanned) && (
          <div
            className={`flex size-6 items-center justify-center rounded-full ${
              scanned ? "bg-emerald-500/20" : "bg-blue-500/20"
            }`}
          >
            <CheckCircle2
              className={`size-4 ${
                scanned ? "text-emerald-400" : "text-blue-400"
              }`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TypingText({ text, speed = 25 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const idxRef = useRef(0);

  useEffect(() => {
    idxRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on text change
    setDisplayed("");
    const id = setInterval(() => {
      idxRef.current++;
      if (idxRef.current <= text.length) {
        setDisplayed(text.slice(0, idxRef.current));
      } else {
        clearInterval(id);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="ml-px inline-block h-4 w-0.5 animate-pulse align-text-bottom bg-blue-400" />
      )}
    </span>
  );
}

function ProcessingDots({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-lg bg-neutral-800/30 px-3 py-2.5"
    >
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-blue-400"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-[15px] text-neutral-400">{label}</span>
    </motion.div>
  );
}

/* ────────────────────────────────────────────
   STEP RENDERERS
   ──────────────────────────────────────────── */

function UploadView({ progress }: { progress: number }) {
  return (
    <div className="space-y-4">
      {progress === 0 ? (
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-blue-400" />
          <span className="text-[16px] text-neutral-300">
            Select a machine manual
          </span>
        </div>
      ) : progress < 100 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="size-5 text-blue-400" />
              <span className="text-[16px] text-neutral-300">
                Uploading manual...
              </span>
            </div>
            <span className="font-mono text-[15px] text-neutral-500">
              {progress}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.15 }}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-400" />
          <span className="text-[16px] text-emerald-300">
            Upload complete
          </span>
        </div>
      )}
      <PdfCard selected={progress > 0} scanned={false} />
    </div>
  );
}

function ScanView({ progress }: { progress: number }) {
  const items = [
    "Text detected",
    "Tables detected",
    "Diagrams detected",
    "Error codes detected",
    "Safety instructions detected",
  ];
  const visibleCount = Math.min(
    items.length,
    Math.floor((progress / 100) * items.length) + 1
  );
  const pageCount = Math.round((progress / 100) * DEMO_MANUAL.pages);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileSearch className="size-5 text-purple-400" />
        <span className="text-[16px] text-neutral-300">
          {progress < 100 ? "Scanning your manual..." : "Manual scanned"}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-neutral-700/30 bg-neutral-800/30 p-4">
        {progress < 100 && (
          <motion.div
            className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent"
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          {items.slice(0, visibleCount).map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span className="text-[15px] text-neutral-400">{item}</span>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="text-center">
        <span className="text-[15px] text-neutral-500">
          {progress < 100
            ? `Scanning ${pageCount} of ${DEMO_MANUAL.pages} pages...`
            : `${DEMO_MANUAL.pages} pages scanned`}
        </span>
      </div>
    </div>
  );
}

function UnderstandView({ progress }: { progress: number }) {
  const extractItems = [
    "Text extracted",
    "Tables detected",
    "Error codes found",
    "Safety instructions found",
    "Diagrams detected",
  ];
  const pipelineStages = [
    { label: "Manual", icon: FileText, color: "text-blue-400" },
    { label: "Extract", icon: Brain, color: "text-purple-400" },
    { label: "Chunk", icon: Database, color: "text-cyan-400" },
    { label: "Embed", icon: Cpu, color: "text-indigo-400" },
    { label: "KB", icon: Database, color: "text-emerald-400" },
  ];
  const showPipeline = progress > 45;
  const extractCount = Math.min(
    extractItems.length,
    Math.floor((progress / 45) * extractItems.length) + 1
  );
  const chunks = Math.round((progress / 100) * 1284);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Brain className="size-5 text-cyan-400" />
        <span className="text-[16px] text-neutral-300">
          {progress < 100
            ? "Understanding your manual..."
            : "Manual ready for questions"}
        </span>
      </div>
      {!showPipeline && (
        <div className="space-y-2">
          {extractItems.slice(0, extractCount).map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
              className="flex items-center gap-3 rounded-md bg-neutral-800/30 px-3 py-2"
            >
              <CheckCircle2 className="size-3.5 text-cyan-400" />
              <span className="text-[15px] text-neutral-300">{item}</span>
            </motion.div>
          ))}
        </div>
      )}
      {showPipeline && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-1">
            {pipelineStages.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <React.Fragment key={stage.label}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.15 }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg border border-neutral-700/50 bg-neutral-800/50 sm:size-11">
                      <Icon className={`size-4 sm:size-5 ${stage.color}`} />
                    </div>
                    <span className="text-[13px] text-neutral-500">
                      {stage.label}
                    </span>
                  </motion.div>
                  {i < pipelineStages.length - 1 && (
                    <ChevronRight className="size-3.5 text-neutral-700" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-md bg-neutral-800/30 px-3 py-2">
              <p className="font-mono text-[16px] font-semibold text-white">
                {DEMO_MANUAL.pages}
              </p>
              <p className="text-[13px] text-neutral-500">pages</p>
            </div>
            <div className="rounded-md bg-neutral-800/30 px-3 py-2">
              <p className="font-mono text-[16px] font-semibold text-white">
                {chunks.toLocaleString()}
              </p>
              <p className="text-[13px] text-neutral-500">chunks</p>
            </div>
            <div className="rounded-md bg-neutral-800/30 px-3 py-2">
              <p className="font-mono text-[16px] font-semibold text-white">
                {chunks.toLocaleString()}
              </p>
              <p className="text-[13px] text-neutral-500">embeddings</p>
            </div>
          </div>
          {progress >= 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center"
            >
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span className="text-[15px] font-medium text-emerald-400">
                  Knowledge base ready
                </span>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function AskView({ typed }: { typed: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="size-5 text-blue-400" />
        <span className="text-[16px] text-neutral-300">Ask MechMind</span>
      </div>
      <div className="rounded-xl border border-neutral-700/30 bg-neutral-800/30 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-full bg-blue-500/20">
            <MessageSquare className="size-3.5 text-blue-400" />
          </div>
          <span className="text-[15px] font-medium text-neutral-400">
            MechMind Assistant
          </span>
        </div>
        <div className="rounded-lg bg-neutral-900/50 p-3.5">
          <div className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-[13px] text-neutral-300">
              T
            </div>
            <p className="text-[16px] leading-relaxed text-neutral-200">
              <TypingText text={DEMO_QUESTION} speed={22} />
            </p>
          </div>
        </div>
      </div>
      {typed && (
        <>
          <ProcessingDots label="Understanding your question..." />
          <ProcessingDots label="Searching your machine knowledge..." />
        </>
      )}
    </div>
  );
}

function RetrieveView({ progress }: { progress: number }) {
  const showSources = progress > 20;
  const showBest = progress > 70;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Search className="size-5 text-blue-400" />
        <span className="text-[16px] text-neutral-300">
          {progress < 100
            ? "Searching knowledge base..."
            : "Best evidence selected"}
        </span>
      </div>

      <div className="rounded-lg border border-neutral-700/30 bg-neutral-800/30 p-3.5">
        <p className="text-[15px] text-neutral-400 leading-relaxed">
          {DEMO_QUESTION}
        </p>
      </div>

      <div className="flex items-center justify-center">
        <svg width="2" height="32" className="text-neutral-700">
          <motion.line
            x1="1"
            y1="0"
            x2="1"
            y2="32"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 3"
            animate={{ strokeDashoffset: [0, -6] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        </svg>
      </div>

      {showSources && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-purple-400" />
            <span className="text-[15px] text-neutral-500">
              Knowledge base
            </span>
          </div>
          {DEMO_SOURCES.map((src, i) => (
            <motion.div
              key={src.title}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.2 }}
              className={`flex items-center justify-between rounded-lg border p-3 transition-all duration-300 ${
                showBest && src.highlight
                  ? "border-blue-500/30 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.1)]"
                  : "border-neutral-700/30 bg-neutral-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText
                  className={`size-4 ${
                    showBest && src.highlight
                      ? "text-blue-400"
                      : "text-neutral-500"
                  }`}
                />
                <span
                  className={`text-[15px] ${
                    showBest && src.highlight
                      ? "font-medium text-blue-300"
                      : "text-neutral-400"
                  }`}
                >
                  {src.title}
                </span>
              </div>
              <span className="text-[13px] text-neutral-600">p.{src.page}</span>
            </motion.div>
          ))}
        </div>
      )}

      {showBest && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2.5 rounded-lg bg-blue-500/5 px-3 py-2.5"
        >
          <Sparkles className="size-4 text-blue-400" />
          <span className="text-[15px] text-blue-300">
            Best evidence selected
          </span>
        </motion.div>
      )}
    </div>
  );
}

function AnswerView({ progress }: { progress: number }) {
  const showTitle = progress > 5;
  const showCause = progress > 15;
  const showChecks = progress > 30;
  const checksVisible = Math.min(
    DEMO_ANSWER_STEPS.length,
    Math.floor(((progress - 30) / 40) * DEMO_ANSWER_STEPS.length) + 1
  );
  const showSafety = progress > 70;
  const showSource = progress > 82;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Sparkles className="size-5 text-emerald-400" />
        <span className="text-[16px] text-neutral-300">
          {progress < 100
            ? "Generating evidence-backed answer..."
            : "Evidence-backed answer"}
        </span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3 rounded-xl border border-neutral-700/30 bg-neutral-800/30 p-4"
      >
        {showTitle && (
          <p className="text-[16px] font-semibold text-white">
            E101 — Emergency Circuit Fault
          </p>
        )}
        {showCause && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="mb-1 text-[13px] uppercase tracking-wider text-neutral-600">
              Probable cause
            </p>
            <p className="text-[15px] text-neutral-300 leading-relaxed">
              The emergency-stop or safety circuit has been interrupted.
            </p>
          </motion.div>
        )}
        {showChecks && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="mb-1.5 text-[13px] uppercase tracking-wider text-neutral-600">
              Recommended checks
            </p>
            <div className="space-y-1">
              {DEMO_ANSWER_STEPS.map(
                (step, i) =>
                  i < checksVisible && (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2"
                    >
                      <span className="mt-0.5 font-mono text-[15px] text-blue-400">
                        {i + 1}.
                      </span>
                      <span className="text-[15px] text-neutral-300">
                        {step}
                      </span>
                    </motion.div>
                  )
              )}
            </div>
          </motion.div>
        )}
        {showSafety && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <p className="text-[14px] leading-relaxed text-amber-300/80">
              Safety first — follow the machine&apos;s safety procedure before
              inspecting electrical components.
            </p>
          </motion.div>
        )}
        {showSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-t border-neutral-700/30 pt-3"
          >
            <p className="mb-1.5 text-[13px] uppercase tracking-wider text-neutral-600">
              Source
            </p>
            <div className="flex items-center gap-2.5">
              <BookOpen className="size-4 text-neutral-500" />
              <span className="text-[15px] text-neutral-400">
                CNC-200 Pro Manual v4.2 — Emergency Circuit, p.42
              </span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-neutral-700/30 bg-neutral-800/50 px-3 py-1.5">
              <Search className="size-3.5 text-neutral-500" />
              <span className="text-[14px] text-neutral-400">
                View source &rarr;
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

/* ────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────── */

export function MechMindDemo() {
  const [step, setStep] = useState<DemoStep>("upload");
  const [progress, setProgress] = useState(0);
  const [typed, setTyped] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stepKey, setStepKey] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const clearAll = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const goTo = useCallback(
    (nextStep: DemoStep, delay: number) => {
      clearAll();
      if (!mountedRef.current) return;
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setStep(nextStep);
          setStepKey((k) => k + 1);
          setProgress(0);
          setTyped(false);
        }
      }, delay);
    },
    [clearAll]
  );

  const runProgress = useCallback(
    (duration: number, onDone: () => void) => {
      clearAll();
      if (!mountedRef.current) return;
      const steps = 20;
      const interval = duration / steps;
      let current = 0;
      intervalRef.current = setInterval(() => {
        current++;
        const val = Math.min(100, Math.round((current / steps) * 100));
        if (mountedRef.current) {
          setProgress(val);
        }
        if (current >= steps) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          if (mountedRef.current) onDone();
        }
      }, interval);
    },
    [clearAll]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAll();
    };
  }, [clearAll]);

  useEffect(() => {
    if (paused) {
      clearAll();
      return;
    }

    clearAll();

    switch (step) {
      case "upload": {
        const t1 = setTimeout(() => {
          if (!mountedRef.current) return;
          setProgress(20);
          const t2 = setTimeout(() => {
            if (!mountedRef.current) return;
            setProgress(40);
            const t3 = setTimeout(() => {
              if (!mountedRef.current) return;
              setProgress(60);
              const t4 = setTimeout(() => {
                if (!mountedRef.current) return;
                setProgress(80);
                const t5 = setTimeout(() => {
                  if (!mountedRef.current) return;
                  setProgress(100);
                  goTo("scan", 700);
                }, 600);
                timerRef.current = t5;
              }, 600);
              timerRef.current = t4;
            }, 600);
            timerRef.current = t3;
          }, 600);
          timerRef.current = t2;
        }, 1000);
        timerRef.current = t1;
        break;
      }

      case "scan": {
        runProgress(WORKFLOW_TIMINGS.scan, () => {
          goTo("understand", 400);
        });
        break;
      }

      case "understand": {
        runProgress(WORKFLOW_TIMINGS.understand, () => {
          goTo("ask", 400);
        });
        break;
      }

      case "ask": {
        const typingDuration = DEMO_QUESTION.length * 22 + 500;
        const t1 = setTimeout(() => {
          if (!mountedRef.current) return;
          setTyped(true);
          goTo("retrieve", WORKFLOW_TIMINGS.ask - typingDuration);
        }, typingDuration);
        timerRef.current = t1;
        break;
      }

      case "retrieve": {
        runProgress(WORKFLOW_TIMINGS.retrieve, () => {
          goTo("answer", 500);
        });
        break;
      }

      case "answer": {
        runProgress(WORKFLOW_TIMINGS.answer, () => {
          goTo("ready", 500);
        });
        break;
      }

      case "ready": {
        goTo("reset", WORKFLOW_TIMINGS.ready);
        break;
      }

      case "reset": {
        goTo("upload", WORKFLOW_TIMINGS.reset);
        break;
      }
    }

    return clearAll;
  }, [stepKey, paused, clearAll, goTo, runProgress, step]);

  const handlePause = () => setPaused((p) => !p);
  const handleReplay = () => {
    clearAll();
    setProgress(0);
    setTyped(false);
    setStep("upload");
  };

  return (
    <div
      className="mx-auto w-full max-w-[410px] overflow-hidden rounded-[22px] border border-white/20 bg-[#0f0f0f] shadow-2xl shadow-black/25 sm:max-w-none sm:rounded-2xl"
      aria-hidden="true"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Sidebar */}
        <div className="flex w-full shrink-0 flex-row items-center justify-start gap-1 border-b border-neutral-800 bg-[#0f0f0f] p-2 sm:w-44 sm:flex-col sm:items-stretch sm:border-b-0 sm:border-r sm:border-neutral-800 sm:p-3">
          <p className="hidden font-gothic text-xl tracking-wide text-white sm:mb-6 sm:block">
            MechMind
          </p>
          <nav className="flex flex-row gap-1 sm:flex-col">
            {[
              { id: "home", label: "Home", Icon: Zap },
              { id: "diagnose", label: "Diagnose", Icon: Search },
              { id: "machines", label: "Machines", Icon: Cpu },
              { id: "manuals", label: "Manuals", Icon: BookOpen },
              { id: "analytics", label: "Analytics", Icon: Database },
              { id: "library", label: "Library", Icon: FileText },
              { id: "settings", label: "Settings", Icon: Shield },
            ].map((item) => {
              const IconComp = item.Icon;
              const isActive = item.id === "home";
              return (
                <div
                  key={item.id}
                  className={`flex size-9 cursor-default items-center justify-center gap-2 rounded-lg font-poppins text-[14px] font-medium transition-all duration-100 sm:size-auto sm:justify-start sm:px-3 sm:py-2.5 sm:text-[15px] ${
                    isActive ? "bg-neutral-800 text-white" : "text-neutral-600"
                  }`}
                >
                  <IconComp className="size-4 shrink-0 sm:size-5" />
                  <span className="hidden sm:inline truncate">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </nav>
          <div className="hidden border-t border-neutral-800 pt-3 sm:mt-auto sm:block">
            <div className="flex items-center gap-2.5 rounded-lg bg-neutral-800/50 px-3 py-2.5">
              <div className="flex size-7 items-center justify-center rounded-full bg-blue-500/20 text-[14px] font-bold text-blue-400">
                T
              </div>
              <p className="truncate font-poppins text-[15px] text-neutral-400">
                Demo User
              </p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex h-[500px] flex-col sm:h-auto sm:min-h-[720px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <h2 className="text-[16px] font-semibold uppercase tracking-[0.15em] text-neutral-300 sm:text-[17px]">
                  How MechMind Works
                </h2>
                <p className="mt-0.5 text-[14px] text-neutral-600 sm:text-[15px]">
                  From machine manuals to evidence-backed troubleshooting
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePause}
                  className="flex size-6 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
                  aria-label={paused ? "Play" : "Pause"}
                >
                  {paused ? (
                    <Play className="size-3" />
                  ) : (
                    <Pause className="size-3" />
                  )}
                </button>
                <button
                  onClick={handleReplay}
                  className="flex size-6 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
                  aria-label="Replay"
                >
                  <RotateCcw className="size-3" />
                </button>
              </div>
            </div>

            {/* Demo area */}
            <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 no-scrollbar">
              <AnimatePresence mode="wait">
                {step === "upload" && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <UploadView progress={progress} />
                  </motion.div>
                )}

                {step === "scan" && (
                  <motion.div
                    key="scan"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ScanView progress={progress} />
                  </motion.div>
                )}

                {step === "understand" && (
                  <motion.div
                    key="understand"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <UnderstandView progress={progress} />
                  </motion.div>
                )}

                {step === "ask" && (
                  <motion.div
                    key="ask"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AskView typed={typed} />
                  </motion.div>
                )}

                {step === "retrieve" && (
                  <motion.div
                    key="retrieve"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <RetrieveView progress={progress} />
                  </motion.div>
                )}

                {step === "answer" && (
                  <motion.div
                    key="answer"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AnswerView progress={progress} />
                  </motion.div>
                )}

                {step === "ready" && (
                  <motion.div
                    key="ready"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center py-10"
                  >
                    <CheckCircle2 className="mb-3 size-10 text-emerald-400" />
                    <p className="text-[18px] font-medium text-neutral-300">
                      Ready for your next question.
                    </p>
                    <p className="mt-1.5 text-[15px] text-neutral-600">
                      Restarting shortly...
                    </p>
                  </motion.div>
                )}

                {step === "reset" && (
                  <motion.div
                    key="reset"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center py-10"
                  >
                    <div className="size-1 rounded-full bg-neutral-700" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Workflow bar */}
            <div className="border-t border-neutral-800 px-3 py-2 sm:px-4 sm:py-3">
              <WorkflowBar
                currentStep={
                  step === "ready" || step === "reset" ? "answer" : step
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MechMindDemo;
