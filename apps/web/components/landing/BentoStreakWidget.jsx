"use client";

import React from "react";
import { streakData } from "./landingData";

export default function BentoStreakWidget() {
  const { currentStreak, longestStreak, weeklyGoalPercent } = streakData;

  return (
    <div className="flex flex-col rounded-3xl border border-[#fde1a8]/80 bg-[#fff6e3] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">
          Streak
        </h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#f59e0b]">
          On fire
        </span>
      </div>

      <div className="mt-5 flex items-end gap-3">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="#f59e0b">
          <path d="M12 2c.6 2.4-.6 3.6-1.5 5C9.5 8.6 8 10 8 12.5c0 2.2 1.5 3.9 3.5 4-1-1-1.4-2-1-3.2.7-2 2.4-3.2 3-5.3.5 1 .4 2-.3 3 .6 0 1 .3 1.3.7C15.7 13.2 16 14.6 16 16c0 2-1.2 3-2.8 3.4-.4.1-.6.5-.3.8 2.7.3 5.3-1.6 5.3-4.6 0-3.7-3.4-8-6.2-13.6z" />
        </svg>
        <span className="font-instrumental text-6xl leading-none text-neutral-900">
          {currentStreak}
        </span>
        <span className="mb-1 font-poppins text-sm font-medium text-neutral-600">
          days
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <div className="flex items-center justify-between font-poppins text-xs text-neutral-500">
          <span>Weekly goal</span>
          <span className="font-semibold text-neutral-800">{weeklyGoalPercent}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#fde1a8]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#c64e27]"
            style={{ width: `${weeklyGoalPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
        <span className="font-poppins text-xs text-neutral-500">Longest streak</span>
        <span className="font-poppins text-sm font-bold text-neutral-900">
          {longestStreak} days
        </span>
      </div>
    </div>
  );
}
