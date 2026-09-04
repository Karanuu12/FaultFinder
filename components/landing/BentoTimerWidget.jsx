"use client";

import React, { useEffect, useRef, useState } from "react";
import { formatDuration } from "./format";

const SESSION_LENGTH = 25 * 60;

export default function BentoTimerWidget() {
  const [remaining, setRemaining] = useState(SESSION_LENGTH);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        setElapsed((e) => e + 1);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const start = () => {
    if (remaining === 0) {
      setRemaining(SESSION_LENGTH);
      setElapsed(0);
    }
    setRunning(true);
  };

  const pause = () => setRunning(false);

  const reset = () => {
    setRunning(false);
    setRemaining(SESSION_LENGTH);
    setElapsed(0);
  };

  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, elapsed / SESSION_LENGTH);
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center rounded-3xl border border-[#cfe9c8]/80 bg-[#eeffe8] px-6 py-6 shadow-sm">
      <div className="flex w-full items-center justify-between">
        <span className="font-poppins text-[10px] font-semibold uppercase tracking-[0.2em] text-[#359462]">
          Session
        </span>
        <span className="rounded-full bg-white/80 px-3 py-1 font-poppins text-[10px] font-medium text-neutral-600 shadow-sm">
          Deep Work
        </span>
      </div>

      <div className="relative mt-5 flex items-center justify-center">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="12"
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#359462"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="font-instrumental text-5xl leading-none text-neutral-900">
            {formatDuration(remaining)}
          </span>
          <span className="mt-1.5 font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
            {running ? "in progress" : "paused"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        {running ? (
          <button
            onClick={pause}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#359462] px-5 py-2 font-poppins text-sm font-medium text-white shadow-sm transition-all hover:bg-[#2c7a51] active:scale-95"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
            Pause
          </button>
        ) : (
          <button
            onClick={start}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#359462] px-5 py-2 font-poppins text-sm font-medium text-white shadow-sm transition-all hover:bg-[#2c7a51] active:scale-95"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4v16l13-8z" />
            </svg>
            Start
          </button>
        )}
        <button
          onClick={reset}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#359462]/40 bg-white/70 px-5 py-2 font-poppins text-sm font-medium text-[#359462] transition-all hover:bg-white active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
          </svg>
          Reset
        </button>
      </div>
    </div>
  );
}
