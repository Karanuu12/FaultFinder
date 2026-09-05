"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINK_IDS = ["home", "stats", "features", "preview"] as const;

function useIsLoggedIn() {
  return useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && !!localStorage.getItem("token"),
    () => false
  );
}

export const Navbar = () => {
  const { t } = useI18n();
  const isLoggedIn = useIsLoggedIn();
  const [active, setActive] = useState("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = NAV_LINK_IDS.map((id) => ({ id, label: t(`nav.${id === "home" ? "home" : id}`) }));

  useEffect(() => {
    const visible = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting);
        }
        const activeId = NAV_LINK_IDS
          .map((id) => ({ id, el: document.getElementById(id) }))
          .filter(({ id, el }) => el && visible.get(id))
          .sort(
            (a, b) =>
              (a.el?.getBoundingClientRect().top ?? 0) -
              (b.el?.getBoundingClientRect().top ?? 0)
          )
          .map(({ id }) => id)[0];
        if (activeId) setActive(activeId);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    const sections = NAV_LINK_IDS.map((id) =>
      document.getElementById(id)
    ).filter(Boolean) as HTMLElement[];
    sections.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <header className="fixed inset-x-0 top-5 z-50 flex justify-center px-3 sm:top-8 sm:px-4">
      <nav className="relative flex h-12 w-full max-w-[390px] items-center justify-between rounded-full border border-neutral-200/80 bg-white/70 px-4 text-black shadow-xl shadow-black/5 backdrop-blur-2xl sm:h-14 sm:max-w-[720px] sm:px-6">
        <Link href="/" className="text-xl font-bold font-gothic tracking-wide">
          {t("common.faultFinder")}
        </Link>

        <div className="hidden items-center justify-center gap-1 sm:flex">
          {navLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition-all duration-200 ${
                active === id ? "bg-[#bbf451]" : "hover:text-neutral-700"
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle variant="light" className="hidden sm:flex" />
          <LanguageSwitcher variant="light" className="hidden sm:block" />

          <a
            href="#features"
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white sm:px-5 hover:bg-neutral-800 transition-colors"
          >
            {isLoggedIn ? t("common.dashboard") : t("common.demo")}
          </a>

          <button
            type="button"
            aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-black transition hover:bg-white sm:hidden"
          >
            {isMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] rounded-3xl border border-neutral-200/80 bg-white/95 p-2 shadow-xl shadow-black/10 backdrop-blur-2xl sm:hidden">
            {navLinks.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setIsMenuOpen(false)}
                className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  active === id
                    ? "bg-[#bbf451] text-black"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {label}
              </a>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-neutral-100 pt-1">
              <LanguageSwitcher variant="light" />
              <ThemeToggle variant="light" />
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
