"use client";

import React, { useState } from "react";

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        on ? "bg-[#359462]" : "bg-neutral-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function BentoSettingsWidget() {
  const [theme, setTheme] = useState("Light");
  const [sessionLen, setSessionLen] = useState(25);
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [sound, setSound] = useState(true);
  const [autoStart, setAutoStart] = useState(false);

  const sessions = [25, 50, 90];

  return (
    <div className="rounded-3xl border border-[#bbf451]/40 bg-[#fffbe8] px-6 py-6 shadow-sm">
      <h3 className="font-instrumental text-2xl leading-none text-[#151515]">
        Settings
      </h3>

      <div className="mt-6 flex flex-col gap-5">
        <div>
          <p className="font-poppins text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Theme
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {["Light", "Dark"].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`cursor-pointer rounded-xl px-3 py-2 font-poppins text-sm font-medium transition-all ${
                  theme === t
                    ? "bg-[#151515] text-white shadow-sm"
                    : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-poppins text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Session length
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {sessions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSessionLen(s);
                  setWorkMin(s);
                }}
                className={`cursor-pointer rounded-xl px-2 py-2 font-poppins text-sm font-medium transition-all ${
                  sessionLen === s
                    ? "bg-[#359462] text-white shadow-sm"
                    : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {s} min
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-poppins text-sm font-medium text-neutral-800">
                Work duration
              </p>
              <p className="font-poppins text-[11px] text-neutral-500">
                {workMin} minutes
              </p>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={workMin}
              onChange={(e) => setWorkMin(Number(e.target.value))}
              className="w-32 cursor-pointer accent-[#359462]"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-poppins text-sm font-medium text-neutral-800">
                Break duration
              </p>
              <p className="font-poppins text-[11px] text-neutral-500">
                {breakMin} minutes
              </p>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
              className="w-32 cursor-pointer accent-[#359462]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-poppins text-sm font-medium text-neutral-800">
              Sound alerts
            </p>
            <p className="font-poppins text-[11px] text-neutral-500">
              Play chime on completion
            </p>
          </div>
          <Toggle on={sound} onChange={setSound} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-poppins text-sm font-medium text-neutral-800">
              Auto-start next
            </p>
            <p className="font-poppins text-[11px] text-neutral-500">
              Begin break automatically
            </p>
          </div>
          <Toggle on={autoStart} onChange={setAutoStart} />
        </div>
      </div>
    </div>
  );
}
