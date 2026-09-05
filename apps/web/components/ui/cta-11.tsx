"use client";

import React, { useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import Link from "next/link";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n/context";

function useIsLoggedIn() {
  return useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && !!localStorage.getItem("token"),
    () => false
  );
}

export function CTA11() {
  const { t } = useI18n();
  const isLoggedIn = useIsLoggedIn();
  const stats = { totalManuals: 12, totalQueries: 4800 };

  return (
    <section className="bg-neutral-50 py-16 md:py-24 border-t border-neutral-200/50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center gap-6">
        {/* Star Rating & Social Proof */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="w-5 h-5 fill-yellow-400 text-yellow-400"
              />
            ))}
          </div>
          <p className="text-xs sm:text-sm font-semibold tracking-wide italic text-neutral-500">
            {t("cta11.trustedBy")}
          </p>
        </div>

        {/* Heading */}
        <h2 className="text-4xl sm:text-5xl md:text-6xl tracking-tight text-neutral-900 max-w-2xl leading-none font-medium">
          {t("cta11.heading")}
        </h2>

        {/* Paragraph */}
        <p className="text-base sm:text-lg mt-3 md:text-xl text-neutral-500 max-w-lg">
          {t("cta11.body")}
        </p>

        {/* Number Ticker / Metrics */}
        <div className="my-2 flex flex-col sm:flex-row items-center gap-6 sm:gap-12 border-y border-neutral-200/60 py-4 w-full max-w-xl justify-center">
          <div className="text-center">
            <p className="text-4xl text-neutral-900 font-mono">
              {stats.totalManuals}
            </p>
            <p className="text-sm font-semibold text-neutral-500 tracking-wider">
              {t("cta11.manualsIndexed")}
            </p>
          </div>
          <div className="text-center">
            <p className="text-4xl text-neutral-900 font-mono">
              {stats.totalQueries.toLocaleString()}+
            </p>
            <p className="text-sm font-semibold text-neutral-500 tracking-wider">
              {t("cta11.troubleshootingQueries")}
            </p>
          </div>
          <div className="text-center">
            <p className="text-4xl text-neutral-900 font-mono">100%</p>
            <p className="text-sm font-semibold text-neutral-500 tracking-wider">
              {t("cta11.sourcedAnswers")}
            </p>
          </div>
        </div>

        {/* Dual Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <Button
            asChild
            className="h-12 w-full sm:w-auto rounded-full bg-neutral-950 px-8 text-sm font-semibold text-white hover:bg-neutral-800 shadow-lg shadow-neutral-950/10 transition duration-200"
          >
            <Link href={isLoggedIn ? "/#demo" : "/#demo"}>
              {t("cta11.getStarted")}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 w-full sm:w-auto rounded-full border-neutral-200 bg-white hover:bg-neutral-50 px-8 text-sm font-semibold text-neutral-800 shadow-sm transition duration-200 hover:text-black"
          >
            <Link href="/#demo">
              {t("cta11.viewDemo")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
