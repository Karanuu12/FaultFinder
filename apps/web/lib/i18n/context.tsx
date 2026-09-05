"use client";

/**
 * Site-wide UI language: a single control that decides what language the
 * PAGE ITSELF is written in (nav, headlines, buttons, chat chrome) and, by
 * feeding the same value to `/api/chat`, what language the LLM ANSWERS in.
 * One dropdown, one piece of state, both effects — that unification is the
 * point: a technician who switches the page to Hindi should never have to
 * separately tell the assistant to answer in Hindi too.
 *
 * Persisted to localStorage so a returning visitor keeps their language.
 * Read only after mount (`useEffect`, not `useState(() => localStorage...)`)
 * so the server-rendered HTML and the first client render match exactly —
 * reading localStorage during the initial render would make them diverge
 * and React would throw a hydration-mismatch warning.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICTIONARIES, type UiLanguage, type Dictionary } from "./translations";

const STORAGE_KEY = "faultfinder-ui-lang";

interface I18nContextValue {
  lang: UiLanguage;
  setLang: (lang: UiLanguage) => void;
  /** Full dictionary for the current language, for components that need more than one string. */
  dict: Dictionary;
  /**
   * Dot-path lookup: `t("hero.headline")`, `t("chat.pagesLabel", { pages: 12 })`.
   * Falls back to the English string for a key missing in the current
   * language (should not happen — both are hand-written against the same
   * `Dictionary` type — but a translation gap must never crash the page),
   * and to the key itself if the path is wrong in every language, which is
   * a visible, debuggable failure rather than a blank string.
   */
  t: (path: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolve(dict: Dictionary, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node && typeof node === "object" && key in node) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UiLanguage>("en");

  useEffect(() => {
    // A lazy useState initializer would read localStorage during the FIRST
    // client render, which the server (no localStorage) rendered as "en" --
    // that mismatch is exactly what React's hydration warning exists to catch.
    // Reading here instead means the first paint is briefly English even for
    // a returning Hindi/Marathi user, then corrects -- the same trade-off
    // next-themes makes internally for its own mount-time localStorage read.
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe bootstrap, not a sync loop
      if (stored === "en" || stored === "hi" || stored === "mr") setLangState(stored);
    } catch {
      /* localStorage can throw in a locked-down browser context — English is a fine default */
    }
  }, []);

  useEffect(() => {
    // Screen readers and the browser's own translate/spellcheck heuristics
    // read this attribute; it should track what's actually on screen.
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: UiLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* persistence is a convenience, not a requirement */
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTIONARIES[lang];
    const fallback = DICTIONARIES.en;
    const t = (path: string, vars?: Record<string, string | number>) => {
      const leaf = resolve(dict, path) ?? resolve(fallback, path);
      if (typeof leaf === "function") return leaf((vars ?? {}) as never);
      if (typeof leaf === "string") return leaf;
      return path; // wrong path in every language — surface it, don't hide it
    };
    return { lang, setLang, dict, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n() called outside <I18nProvider> — check app/layout.tsx");
  }
  return ctx;
}
