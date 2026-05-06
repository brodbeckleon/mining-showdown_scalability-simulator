"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { Lang, Translations } from "./i18n";
import { translations } from "./i18n";

type LangCtx = { lang: Lang; setLang: (l: Lang) => void; t: Translations };

const LangContext = createContext<LangCtx>({
  lang: "de",
  setLang: () => {},
  t: translations.de,
});

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "de";
  const stored = localStorage.getItem("lang");
  return stored === "en" || stored === "de" ? stored : "de";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setLangState(readStoredLang());
    setMounted(true);
  }, []);

  const setLang = (l: Lang) => {
    localStorage.setItem("lang", l);
    setLangState(l);
  };

  if (!mounted) {
    return (
      <LangContext.Provider value={{ lang: "de", setLang, t: translations.de }}>
        {children}
      </LangContext.Provider>
    );
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
