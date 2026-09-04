"use client";

import React, { useState } from "react";
import BentoTimerWidget from "./BentoTimerWidget";
import BentoSettingsWidget from "./BentoSettingsWidget";
import BentoHeatmapWidget from "./BentoHeatmapWidget";
import BentoLeaderboardWidget from "./BentoLeaderboardWidget";
import BentoStreakWidget from "./BentoStreakWidget";
import { analyticsStats, focusTags, weeklyFocus, notifications } from "./landingData";
import { formatMinutes, formatNumber } from "./format";

const TABS = [
  { id: "timer", label: "Timer" },
  { id: "tags", label: "Focus Tags" },
  { id: "leaderboards", label: "Leaderboards" },
  { id: "analytics", label: "Analytics" },
];

function TimerTab() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <BentoTimerWidget />
      <BentoSettingsWidget />
    </div>
  );
}

function TagsTab() {
  const total = focusTags.reduce((sum, t) => sum + t.minutes, 0);
  return (
    <div className="rounded-3xl border border-[#ddd0ff]/70 bg-[#faf9f6] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">
          Focus Tags
        </h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#5e2ac4]">
          {focusTags.length} tags
        </span>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {focusTags.map((tag) => {
          const pct = Math.round((tag.minutes / total) * 100);
          return (
            <div
              key={tag.name}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-poppins text-sm font-semibold text-neutral-900">
                    {tag.name}
                  </span>
                  <span className="font-poppins text-xs font-medium text-neutral-500">
                    {formatMinutes(tag.minutes)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: tag.color }}
                  />
                </div>
              </div>
              <span className="font-poppins text-xs font-medium text-neutral-400">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardsTab() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <BentoLeaderboardWidget />
      <BentoStreakWidget />
    </div>
  );
}

function AnalyticsTab() {
  const maxBar = Math.max(...weeklyFocus.map((d) => d.minutes));
  const stats = [
    { label: "Total hours", value: `${analyticsStats.totalFocusHours}h`, color: "#5e2ac4" },
    { label: "Sessions", value: formatNumber(analyticsStats.sessionsCompleted), color: "#c64e27" },
    { label: "Avg session", value: `${analyticsStats.avgSessionMin}m`, color: "#359462" },
    { label: "Best streak", value: `${analyticsStats.bestStreakDays}d`, color: "#bbf451" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-neutral-200/70 bg-white px-4 py-3 shadow-sm"
          >
            <p className="font-poppins text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              {s.label}
            </p>
            <p
              className="mt-1 font-instrumental text-3xl leading-none"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <BentoHeatmapWidget />

      <div className="rounded-3xl border border-[#f0d9b8]/70 bg-[#fff2df] px-6 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-instrumental text-2xl leading-none text-[#151515]">
            Weekly Focus
          </h3>
          <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#c64e27]">
            This week
          </span>
        </div>
        <div className="mt-5 flex h-32 items-end justify-between gap-2">
          {weeklyFocus.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-poppins text-[9px] font-medium text-neutral-500">
                {formatMinutes(d.minutes)}
              </span>
              <div className="flex h-24 w-full items-end">
                <div
                  className="w-full rounded-t-lg"
                  style={{
                    height: `${(d.minutes / maxBar) * 100}%`,
                    backgroundColor: d.day === "Sat" ? "#c64e27" : "#359462",
                  }}
                />
              </div>
              <span className="font-poppins text-[10px] font-medium text-neutral-500">
                {d.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const icons = ["🔥", "🏆", "⚡", "✅", "⏱️", "🎯"];
  const colors = ["#f59e0b", "#5e2ac4", "#0ea5e9", "#359462", "#ef4444", "#94cd59"];
  return (
    <div className="rounded-3xl border border-[#cfe9c8]/80 bg-[#eeffe8] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">
          Activity Feed
        </h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#359462]">
          Live
        </span>
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        {notifications.map((n, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
              style={{ backgroundColor: colors[i % colors.length] }}
            >
              {icons[i % icons.length]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-poppins text-sm font-semibold text-neutral-900">
                  {n.name}
                </p>
                <span className="shrink-0 font-poppins text-[10px] font-medium text-neutral-400">
                  {n.time}
                </span>
              </div>
              <p className="truncate font-poppins text-xs text-neutral-500">
                {n.action}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_CONTENT = {
  timer: <TimerTab />,
  tags: <TagsTab />,
  leaderboards: <LeaderboardsTab />,
  analytics: <AnalyticsTab />,
  notifications: <NotificationsTab />,
};

export default function AppShowcase() {
  const [activeTabs, setActiveTabs] = useState({
    timer: true,
    tags: false,
    leaderboards: false,
    analytics: false,
  });

  const activeKey = TABS.find((t) => activeTabs[t.id]);
  const activeId = activeKey ? activeKey.id : "timer";

  const selectTab = (id) => {
    setActiveTabs({
      timer: false,
      tags: false,
      leaderboards: false,
      analytics: false,
      [id]: true,
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[22px] border border-neutral-200/80 bg-[#fffdf7] shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
      <div className="flex items-center gap-3 border-b border-neutral-200/70 bg-[#faf9f6] px-5 py-3.5">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#c64e27]" />
          <span className="h-3 w-3 rounded-full bg-[#f0b429]" />
          <span className="h-3 w-3 rounded-full bg-[#359462]" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-4 py-1.5 shadow-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94cd59" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="font-poppins text-xs font-medium text-neutral-700">
            timmo.app
          </span>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5e2ac4] text-[10px] font-bold text-white">
          T
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200/70 bg-white px-4 pt-2">
        {TABS.map((tab) => {
          const active = activeId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`relative shrink-0 cursor-pointer rounded-t-xl px-5 py-2.5 font-poppins text-sm font-medium transition-all ${
                active
                  ? "text-[#151515]"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#5e2ac4]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-[#fdfcf9] p-5 sm:p-7">
        {TAB_CONTENT[activeId]}
      </div>
    </div>
  );
}
