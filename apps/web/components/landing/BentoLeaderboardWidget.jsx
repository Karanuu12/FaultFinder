"use client";

import React from "react";
import { leaderboardData } from "./landingData";
import { formatMinutes } from "./format";

function FlameIcon({ className }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="#f59e0b"
      className={className}
    >
      <path d="M12 2c.6 2.4-.6 3.6-1.5 5C9.5 8.6 8 10 8 12.5c0 2.2 1.5 3.9 3.5 4-1-1-1.4-2-1-3.2.7-2 2.4-3.2 3-5.3.5 1 .4 2-.3 3 .6 0 1 .3 1.3.7C15.7 13.2 16 14.6 16 16c0 2-1.2 3-2.8 3.4-.4.1-.6.5-.3.8 2.7.3 5.3-1.6 5.3-4.6 0-3.7-3.4-8-6.2-13.6z" />
    </svg>
  );
}

export default function BentoLeaderboardWidget() {
  const top = leaderboardData.slice(0, 5);

  return (
    <div className="rounded-3xl border border-[#ddd0ff]/70 bg-[#f2eeff] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">
          Leaderboard
        </h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#5e2ac4]">
          Top 5
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {top.map((user) => {
          const isFirst = user.rank === 1;
          return (
            <div
              key={user.rank}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                isFirst
                  ? "border border-[#bbf451]/60 bg-white shadow-sm"
                  : "bg-white/70"
              }`}
            >
              <span
                className={`w-5 text-center font-poppins text-sm font-bold ${
                  isFirst ? "text-[#5e2ac4]" : "text-neutral-400"
                }`}
              >
                {user.rank}
              </span>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-poppins text-sm font-semibold text-neutral-900">
                  {user.name}
                </p>
                <p className="font-poppins text-[11px] text-neutral-500">
                  {formatMinutes(user.focusMinutes)} · {user.sessions} sessions
                </p>
              </div>
              <div className="flex items-center gap-1">
                <FlameIcon className="shrink-0" />
                <span className="font-poppins text-sm font-bold text-neutral-800">
                  {user.streak}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
