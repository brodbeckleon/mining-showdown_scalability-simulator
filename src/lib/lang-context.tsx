"use client";

import { createContext, useContext, useState } from "react";
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
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = (l: Lang) => {
    localStorage.setItem("lang", l);
    setLangState(l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
