"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";

import { Navbar } from "./Navbar";
import { Button } from "./ui/button";
import { AnimatedList } from "./ui/animated-list";
import { Globe } from "./ui/globe";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { WheelPicker, WheelPickerWrapper } from "@/components/wheel-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { CTA11 } from "./ui/cta-11";
import { Footer } from "./footer";
import AppShowcase from "./landing/AppShowcase";
import { MechMindDemo } from "./landing/MechMindDemo";
import {
  Flame,
  Laptop,
  Palette,
  BookOpen,
  PenTool,
  BarChart2,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react";

/** Icon/colour are decorative and language-independent; name/description/time come from the dictionary. */
const FEED_STYLE = [
  { icon: "🔧", color: "#359462" },
  { icon: "🔄", color: "#f59e0b" },
  { icon: "❓", color: "#0ea5e9" },
  { icon: "📖", color: "#8b5cf6" },
  { icon: "⛔", color: "#ef4444" },
];

function NotificationCard({
  name,
  description,
  icon,
  color,
  time,
}: {
  name: string;
  description: string;
  icon: string;
  color: string;
  time: string;
}) {
  return (
    <figure
      className={cn(
        "relative mx-auto w-full cursor-pointer overflow-hidden rounded-2xl p-3",
        "transition-all duration-200 ease-in-out hover:scale-[103%]",
        "bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]"
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: color }}
        >
          <span className="text-base">{icon}</span>
        </div>
        <div className="flex min-w-0 flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center gap-1 text-sm font-semibold text-neutral-900">
            <span className="truncate">{name}</span>
            <span className="text-neutral-300">·</span>
            <span className="shrink-0 text-[11px] font-medium text-neutral-400">
              {time}
            </span>
          </figcaption>
          <p className="truncate text-xs font-medium text-neutral-500">
            {description}
          </p>
        </div>
      </div>
    </figure>
  );
}

const HEAT_LEVELS = [
  "bg-[#f0e4d2]",
  "bg-[#f5c9a8]",
  "bg-[#e8956a]",
  "bg-[#d96a3a]",
  "bg-[#c64e27]",
];

const LEVEL_MINS = [0, 30, 60, 120, 180];

function buildContributionWeeks(weekCount = 14) {
  let seed = 42;
  const next = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (weekCount - 1) * 7);

  const weeks: Array<
    Array<{ level: number; mins: number; date: string } | null>
  > = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const week: Array<{ level: number; mins: number; date: string } | null> =
      [];
    for (let day = 0; day < 7; day++) {
      if (cursor > end) {
        week.push(null);
      } else {
        const roll = next();
        let level = 0;
        if (roll > 0.35) level = 1;
        if (roll > 0.55) level = 2;
        if (roll > 0.75) level = 3;
        if (roll > 0.9) level = 4;

        if (day >= 1 && day <= 5 && level > 0 && next() > 0.5) {
          level = Math.min(4, level + 1);
        }

        week.push({
          level,
          mins: LEVEL_MINS[level],
          date: cursor.toLocaleDateString("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function ContributionGraph({
  weeks,
}: {
  weeks: Array<Array<{ level: number; mins: number; date: string } | null>>;
}) {
  const { t } = useI18n();
  const dayLabels = ["", "M", "", "W", "", "F", ""];

  return (
    <div className="mt-5 w-full">
      <TooltipProvider delayDuration={100}>
        <div className="flex gap-1.5">
          <div className="grid grid-rows-7 gap-[3px] pr-0.5">
            {dayLabels.map((label, i) => (
              <span
                key={i}
                className="flex h-[11px] w-3 items-center justify-end text-[8px] font-medium leading-none text-[#b08968]"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 justify-between gap-[3px] overflow-hidden">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-rows-7 gap-[3px]">
                {week.map((cell, dayIndex) =>
                  cell ? (
                    <Tooltip key={dayIndex}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${cell.date}: ${cell.mins} mins`}
                          className={`h-[11px] w-[11px] rounded-[2px] transition-transform duration-150 hover:scale-125 hover:ring-1 hover:ring-[#c64e27]/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c64e27]/50 ${
                            HEAT_LEVELS[cell.level]
                          }`}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        sideOffset={6}
                        className="border-0 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white"
                      >
                        <span className="font-semibold">{cell.date}</span>
                        <span className="ml-1.5 text-neutral-300">
                          {cell.mins === 0
                            ? t("features.noQuery")
                            : t("features.answered", { mins: cell.mins })}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={dayIndex} className="h-[11px] w-[11px]" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </TooltipProvider>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[9px] font-medium text-[#b08968]">
        <span>{t("features.less")}</span>
        {HEAT_LEVELS.map((color, i) => (
          <span key={i} className={`h-[10px] w-[10px] rounded-[2px] ${color}`} />
        ))}
        <span>{t("features.more")}</span>
      </div>
    </div>
  );
}


function useIsLoggedIn() {
  return useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && !!localStorage.getItem("token"),
    () => false
  );
}

export const Hero = () => {
  const { t, dict, lang } = useI18n();
  const totalUsers = 1240;
  const isLoggedIn = useIsLoggedIn();

  const [selectedTime, setSelectedTime] = useState({
    hours: "0",
    minutes: "0",
    seconds: "10",
  });
  const [remainingSeconds, setRemainingSeconds] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const contributionWeeks = useMemo(() => buildContributionWeeks(14), []);
  const globeConfig = useMemo(
    () => ({
      width: 800,
      height: 800,
      onRender: () => {},
      devicePixelRatio: 2,
      phi: 0,
      theta: 0.3,
      dark: 0,
      diffuse: 0.45,
      mapSamples: 16000,
      mapBrightness: 1.15,
      baseColor: [0.92, 0.9, 1] as [number, number, number],
      markerColor: [0.37, 0.16, 0.77] as [number, number, number],
      glowColor: [0.95, 0.93, 1] as [number, number, number],
      markers: [
        { location: [19.076, 72.8777] as [number, number], size: 0.1 },
        { location: [40.7128, -74.006] as [number, number], size: 0.1 },
        { location: [51.5074, -0.1278] as [number, number], size: 0.08 },
        { location: [35.6762, 139.6503] as [number, number], size: 0.07 },
        { location: [-33.8688, 151.2093] as [number, number], size: 0.06 },
        { location: [1.3521, 103.8198] as [number, number], size: 0.05 },
        { location: [37.7749, -122.4194] as [number, number], size: 0.08 },
        { location: [48.8566, 2.3522] as [number, number], size: 0.06 },
      ],
    }),
    []
  );

  const hoursOptions = Array.from({ length: 24 }, (_, index) => ({
    label: String(index).padStart(2, "0"),
    value: String(index),
  }));
  const minutesOptions = Array.from({ length: 60 }, (_, index) => ({
    label: String(index).padStart(2, "0"),
    value: String(index),
  }));
  const secondsOptions = Array.from({ length: 60 }, (_, index) => ({
    label: String(index).padStart(2, "0"),
    value: String(index),
  }));

  const totalSeconds =
    Number(selectedTime.hours) * 3600 +
    Number(selectedTime.minutes) * 60 +
    Number(selectedTime.seconds);

  const currentDisplaySeconds = isRunning ? remainingSeconds : totalSeconds;

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  const handleStart = () => {
    if (totalSeconds <= 0) return;
    setRemainingSeconds(totalSeconds);
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
  };

  const previewRows = [
    {
      name: "Samiran De",
      initials: "SD",
      bg: "bg-purple-500",
      icon: <Laptop className="w-4 h-4 text-purple-500 shrink-0" />,
      duration: "1.2s",
      streak: "2",
      status: dict.previewSection.resolved,
    },
    {
      name: "Alex Rivera",
      initials: "AR",
      bg: "bg-blue-500",
      icon: <Palette className="w-4 h-4 text-blue-500 shrink-0" />,
      duration: "0.9s",
      streak: "1",
      status: dict.previewSection.resolved,
    },
    {
      name: "Yuki Tanaka",
      initials: "YT",
      bg: "bg-orange-500",
      icon: <BookOpen className="w-4 h-4 text-orange-500 shrink-0" />,
      duration: "1.5s",
      streak: "3",
      status: dict.previewSection.cited,
    },
    {
      name: "Sarah Jenkins",
      initials: "SJ",
      bg: "bg-emerald-500",
      icon: <PenTool className="w-4 h-4 text-emerald-500 shrink-0" />,
      duration: "1.1s",
      streak: "2",
      status: dict.previewSection.resolved,
    },
    {
      name: "Michael Chen",
      initials: "MC",
      bg: "bg-rose-500",
      icon: <BarChart2 className="w-4 h-4 text-rose-500 shrink-0" />,
      duration: "0.8s",
      streak: "0",
      status: dict.previewSection.refused,
    },
  ].map((row, i) => ({
    ...row,
    activity: dict.previewSection.rows[i].activity,
    time: dict.previewSection.rows[i].time,
  }));

  return (
    <main className="min-h-screen w-screen overflow-x-hidden bg-neutral-50 text-neutral-950 font-sans">
      <Navbar />

      <section
        id="home"
        className="relative isolate overflow-hidden px-4 pb-14 pt-36 sm:min-h-[110vh] sm:pb-0 sm:pt-36"
      >
        <div className="absolute inset-x-0 top-0 -z-10 h-screen overflow-hidden">
          <div className="h-full w-full bg-[url('/trendybg.png')] bg-cover bg-center" />
        </div>
        <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-white via-white/70 to-transparent" />

        <div className="mx-auto flex w-full max-w-7xl flex-col items-center text-center">
          <div className="pt-12 sm:pt-[15vh]">
            <h1
              className={cn(
                "mx-auto max-w-[22rem] text-[2.2rem] tracking-[-0.01em] text-black/90 sm:max-w-4xl sm:text-5xl sm:tracking-[-0.02em] md:text-7xl font-bold",
                // Devanagari's vowel signs (matras) sit above and below the
                // consonant, extending past what a Latin line-height assumes.
                // The 0.92/1.04 values below were tuned for Latin ascenders/
                // descenders only and clip Hindi/Marathi matras on a two-line
                // headline -- looser leading fixes it without touching the
                // English default.
                lang === "en" ? "leading-[1.04] sm:leading-[0.92]" : "leading-[1.28] sm:leading-[1.15]",
              )}
            >
              {t("hero.headline")}
            </h1>
            <p className="mx-auto mt-4 max-w-[21rem] text-[13px] leading-6 text-black/80 sm:mt-6 sm:max-w-xl sm:text-base sm:leading-7 lg:text-lg">
              {t("hero.subhead")}
            </p>

            <div className="mx-auto mt-7 flex w-full max-w-[23rem] flex-col items-center justify-center gap-3 px-0 sm:mt-10 sm:max-w-none sm:w-auto sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-11 w-full rounded-full bg-neutral-950 px-8 text-sm font-semibold text-white hover:bg-neutral-800 sm:h-12 sm:w-auto sm:text-lg"
              >
                <Link href="/chat">
                  {t("hero.ctaPrimary")}
                </Link>
              </Button>
              <Button
                onClick={() =>
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="h-11 w-full rounded-full border border-lime-500/70 bg-lime-300 px-8 text-sm font-semibold text-black transition-all duration-200 hover:bg-lime-400 sm:h-12 sm:w-auto sm:text-lg"
              >
                {t("hero.ctaSecondary")}
              </Button>
            </div>
          </div>

          <div className="mt-9 w-full max-w-6xl px-0 sm:mt-12 sm:px-4">
            <MechMindDemo />
          </div>
        </div>
      </section>

      <section
        id="stats"
        className="bg-neutral-50 overflow-hidden mt-16 sm:mt-20"
      >
        <div className="flex flex-col justify-center items-center px-4 py-8 gap-3 sm:py-10 sm:gap-5">
          <h1 className="text-3xl max-w-sm text-center font-medium leading-tight sm:text-4xl md:text-5xl sm:max-w-lg">
            {t("stats.heading")}
          </h1>
          <p className="text-base text-neutral-600 sm:text-xl">
            {t("stats.subhead")}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-6 px-4 sm:gap-10 sm:px-0 lg:flex-row">
          {[
            {
              videoSrc: "/video1.webm",
              value: totalUsers,
              suffix: "+",
              description: t("stats.chunksIndexed"),
            },
            {
              videoSrc: "/video2.webm",
              value: 6,
              suffix: "",
              description: t("stats.manualsLoaded"),
            },
            {
              videoSrc: "/video3.webm",
              value: 365,
              suffix: "",
              description: t("stats.errorCodesResolved"),
            },
          ].map((card, index) => (
            <div
              key={index}
              className="mt-5 rounded-2xl bg-white p-2 shadow-md ring-1 ring-neutral-100 md:mt-0"
            >
              <div className="w-80 max-w-80 rounded-xl bg-neutral-100 px-2 py-2 h-[240px] overflow-hidden">
                <video
                  src={card.videoSrc}
                  className="h-full w-full rounded-xl object-cover"
                  preload="auto"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>

              <div className="px-4 py-3">
                <h2 className="text-xl font-semibold">
                  <NumberFlow
                    value={card.value}
                    className="tabular-nums inline-block"
                  />
                  {card.suffix}
                </h2>
                <p className="whitespace-nowrap text-base font-medium text-neutral-500">
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="bg-neutral-50 overflow-hidden py-10 md:py-20 my-10 md:my-20"
      >
        <div className="flex flex-col justify-center items-center px-4 py-8 gap-3 sm:px-6 lg:px-8 sm:py-10 sm:gap-5">
          <h1 className="text-3xl max-w-sm text-center font-medium leading-tight sm:text-4xl md:text-5xl sm:max-w-lg">
            {t("features.heading")}
          </h1>
          <p className="text-base text-center text-neutral-600 sm:text-xl">
            {t("features.subhead")}
          </p>
          <div className="grid grid-cols-1 mt-8 w-full max-w-7xl gap-5 px-5 sm:mt-10 sm:px-0 md:grid-cols-3">
            {/* First Box */}
            <div className="bg-purple-100/60 border overflow-hidden grid border-purple-300/50 h-full rounded-3xl flex-col items-start justify-start">
              <div>
                <video
                  src="/firstbox.mp4"
                  className="h-4/5 w-full rounded-xl scale-110 object-cover -mt-7"
                  preload="auto"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
              <div className="px-8 py-5">
                <div>
                  <div className="[&_h3]:leading-[1.18]">
                    <h3 className="text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                      <span className="block text-[#7B35F0]">{t("features.box1Title1")}</span>
                      <span className="block text-[#17152A]">{t("features.box1Title2")}</span>
                    </h3>
                  </div>

                  <p className="mt-3 max-w-[360px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">
                    {t("features.box1Body")}
                  </p>
                </div>
              </div>
            </div>

            {/* Second Box */}
            <div className="col-span-1 md:col-span-2 flex h-auto min-h-[420px] md:h-100 items-center justify-center rounded-3xl bg-sky-100/60 border border-sky-200/60 px-4 py-8 sm:px-8">
              <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
                <div className="max-w-[320px] text-left">
                  <div className="[&_h3]:leading-[1.18]">
                    <h3 className="text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                      <span className="block text-[#0586d2]">{t("features.box2Title1")}</span>
                      <span className="block text-[#17152A]">
                        {t("features.box2Title2")}
                      </span>
                    </h3>
                  </div>

                  <p className="mt-3 text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">
                    {t("features.box2Body")}
                  </p>
                </div>

                <div className="w-full max-w-[520px]">
                  <div className="flex items-center justify-center gap-2 sm:gap-6">
                    <div className="flex min-w-[76px] sm:min-w-[96px] flex-col items-center rounded-xl sm:rounded-2xl bg-white/70 px-2 py-2 sm:px-3 sm:py-3 shadow-sm">
                      <span className="mb-2 text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.24em] text-slate-500">
                        {t("features.hours")}
                      </span>
                      <WheelPickerWrapper className="w-16 sm:w-24">
                        <WheelPicker
                          options={hoursOptions}
                          value={selectedTime.hours}
                          onValueChange={(value: string) =>
                            setSelectedTime((prev) => ({
                              ...prev,
                              hours: value,
                            }))
                          }
                        />
                      </WheelPickerWrapper>
                    </div>

                    <div className="flex min-w-[76px] sm:min-w-[96px] flex-col items-center rounded-xl sm:rounded-2xl bg-white/70 px-2 py-2 sm:px-3 sm:py-3 shadow-sm">
                      <span className="mb-2 text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.24em] text-slate-500">
                        {t("features.min")}
                      </span>
                      <WheelPickerWrapper className="w-16 sm:w-24">
                        <WheelPicker
                          options={minutesOptions}
                          value={selectedTime.minutes}
                          onValueChange={(value: string) =>
                            setSelectedTime((prev) => ({
                              ...prev,
                              minutes: value,
                            }))
                          }
                        />
                      </WheelPickerWrapper>
                    </div>

                    <div className="flex min-w-[76px] sm:min-w-[96px] flex-col items-center rounded-xl sm:rounded-2xl bg-white/70 px-2 py-2 sm:px-3 sm:py-3 shadow-sm">
                      <span className="mb-2 text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.24em] text-slate-500">
                        {t("features.sec")}
                      </span>
                      <WheelPickerWrapper className="w-16 sm:w-24">
                        <WheelPicker
                          options={secondsOptions}
                          value={selectedTime.seconds}
                          onValueChange={(value: string) =>
                            setSelectedTime((prev) => ({
                              ...prev,
                              seconds: value,
                            }))
                          }
                        />
                      </WheelPickerWrapper>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-3 text-center">
                    <div className="flex gap-2">
                      <Button
                        onClick={handleStart}
                        disabled={totalSeconds <= 0 || isRunning}
                        className="rounded-full bg-[#0586d2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0470b5]"
                      >
                        {t("hero.start")}
                      </Button>
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className="rounded-full border-sky-200 bg-white hover:text-black px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {t("hero.reset")}
                      </Button>
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {isRunning ? t("hero.countingDown") : t("hero.ready")}
                      <NumberFlow
                        value={Math.floor(currentDisplaySeconds / 3600)}
                        format={{ minimumIntegerDigits: 2 }}
                        className="tabular-nums inline-block w-[2ch] text-center"
                      />
                      :
                      <NumberFlow
                        value={Math.floor((currentDisplaySeconds % 3600) / 60)}
                        format={{ minimumIntegerDigits: 2 }}
                        className="tabular-nums inline-block w-[2ch] text-center"
                      />
                      :
                      <NumberFlow
                        value={currentDisplaySeconds % 60}
                        format={{ minimumIntegerDigits: 2 }}
                        className="tabular-nums inline-block w-[2ch] text-center"
                      />
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Third — Activity heatmap */}
            <div className="flex h-100 flex-col overflow-hidden rounded-3xl border border-[#f0d9b8]/70 bg-[#fff2df] px-6 py-6 sm:px-8 sm:py-7">
              <div className="[&_h3]:leading-[1.18]">
                <h3 className="max-w-xs text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                  <span className="block text-[#c64e27]">
                    {t("features.box3Title")}
                  </span>
                </h3>
              </div>

              <p className="mt-3 max-w-[360px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">
                {t("features.box3Body")}
              </p>
              <div className="mt-5">
                <ContributionGraph weeks={contributionWeeks} />
              </div>
            </div>

            {/* Fourth — Live activity feed */}
            <div className="flex h-100 flex-col overflow-hidden rounded-3xl border border-[#cfe9c8]/80 bg-[#eeffe8] px-6 py-6 sm:px-8">
              <div className="[&_h3]:leading-[1.18]">
                <h3 className="max-w-xs text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                  <span className="block text-[#359462]">
                    {t("features.box4Title")}
                  </span>
                </h3>
              </div>

              <p className="mt-3 max-w-[360px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">
                {t("features.box4Body")}
              </p>

              <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
                <AnimatedList delay={1800} className="gap-2.5">
                  {Array.from({ length: 8 }, () =>
                    dict.feed.map((item, i: number) => ({ ...item, ...FEED_STYLE[i] })),
                  )
                    .flat()
                    .map((item, idx) => (
                      <NotificationCard {...item} key={idx} />
                    ))}
                </AnimatedList>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#eeffe8] to-transparent" />
              </div>
            </div>

            {/* Fifth — Community globe */}
            <div className="relative flex h-100 flex-col overflow-hidden rounded-3xl border border-[#ddd0ff]/70 bg-[#f2eeff] px-6 py-6 sm:px-8">
              <div className="relative z-10 [&_h3]:leading-[1.18]">
                <h3 className="max-w-xs text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                  <span className="block text-[#5e2ac4]">
                    {t("features.box5Title")}
                  </span>
                </h3>
              </div>

              <p className="relative z-10 mt-3 max-w-[360px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">
                {t("features.box5Body")}
              </p>

              <div className="relative mt-2 min-h-0 flex-1">
                <Globe
                  className="top-0 left-1/2 max-w-none -translate-x-1/2 scale-110"
                  config={globeConfig}
                />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(94,42,196,0.12),transparent_55%)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive App Showcase Section */}
      <section className="bg-neutral-50 py-10 md:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-neutral-900 leading-tight">
              {t("showcase.heading")}
              </h2>
              <p className="text-neutral-600 mt-2 text-base sm:text-xl">
                {t("showcase.subhead")}
              </p>
            </div>
          <AppShowcase />
        </div>
      </section>

      <section id="preview" className="bg-neutral-50 py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center gap-5">
          <h1 className="text-3xl sm:text-4xl md:text-5xl max-w-lg text-center font-medium leading-tight">
            {t("previewSection.heading")}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-center text-neutral-600 max-w-lg">
            {t("previewSection.subhead")}
          </p>

          <div className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] backdrop-blur-sm p-2 sm:p-4 w-full mt-5">
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-100 hover:bg-transparent">
                  <TableHead className="font-bold text-neutral-600 pl-4">
                    {t("previewSection.tableUser")}
                  </TableHead>
                  <TableHead className="font-bold text-neutral-600">
                    {t("previewSection.tableActivity")}
                  </TableHead>
                  <TableHead className="font-bold text-neutral-600">
                    {t("previewSection.tableDuration")}
                  </TableHead>
                  <TableHead className="font-bold text-neutral-600">
                    {t("previewSection.tableCitations")}
                  </TableHead>
                  <TableHead className="font-bold text-neutral-600">
                    {t("previewSection.tableTime")}
                  </TableHead>
                  <TableHead className="font-bold text-neutral-600 pr-4 text-right">
                    {t("previewSection.tableStatus")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    className="border-neutral-100/50 hover:bg-neutral-50/50 transition-colors"
                  >
                    <TableCell className="font-medium pl-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${row.bg} shadow-sm`}
                        >
                          {row.initials}
                        </div>
                        <span className="font-bold text-neutral-900 text-sm">
                          {row.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-neutral-600 font-medium text-sm">
                      <div className="flex items-center gap-2">
                        {row.icon}
                        <span>{row.activity}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-neutral-900 font-semibold text-sm">
                      {row.duration}
                    </TableCell>
                    <TableCell className="text-neutral-500 font-medium text-sm">
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                        <span className="font-bold text-neutral-800">
                          {row.streak}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-neutral-400 font-medium text-xs">
                      {row.time}
                    </TableCell>
                    <TableCell className="pr-4 text-right py-3.5">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                        <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                        {row.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <CTA11 />

      <section className="bg-neutral-50 px-4 py-16 md:py-24">
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-sm">
          <div className="relative isolate min-h-[360px] bg-[url('/cta.jpeg')] bg-cover bg-center px-6 py-8 sm:px-10 sm:py-10 md:min-h-[390px] md:px-12">
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.82)_44%,rgba(255,255,255,0.28)_72%,rgba(255,255,255,0.05)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-black/10 to-transparent" />

            <div className="flex min-h-[300px] flex-col justify-between gap-10 md:min-h-[310px] md:flex-row md:items-center">
              <div className="max-w-[34rem]">
                <span className="inline-flex items-center rounded-full border border-neutral-900/10 bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-700 backdrop-blur">
                  {t("sponsor.badge")}
                </span>
                <h2 className="mt-5 max-w-lg text-3xl font-medium leading-tight text-neutral-950 sm:text-4xl md:text-5xl">
                  {t("sponsor.heading")}
                </h2>
                <p className="mt-5 max-w-md text-sm font-medium leading-7 text-neutral-700 sm:text-base">
                  {t("sponsor.body")}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:max-w-xs">
                <Button
                  asChild
                  className="h-12 justify-between rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  <a
                    href="https://github.com/sponsors/icancodefyi"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("sponsor.githubSponsors")}
                    <ArrowUpRight className="w-4 h-4 text-white/70 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 justify-between rounded-full border-white/80 bg-white/80 px-5 text-sm font-semibold text-neutral-950 backdrop-blur hover:bg-white hover:text-black"
                >
                  <a
                    href="https://buymeacoffee.com/icancodefyi"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("sponsor.buyMeCoffee")}
                    <ArrowUpRight className="w-4 h-4 text-neutral-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Hero;
