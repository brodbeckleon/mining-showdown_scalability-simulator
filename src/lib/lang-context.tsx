"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  useEffect,
} from "react";
import type { Lang, Translations } from "./i18n";
import { translations } from "./i18n";

type LangCtx = { lang: Lang; setLang: (l: Lang) => void; t: Translations };

const LangContext = createContext<LangCtx>({
  lang: "de",
  setLang: () => {},
  t: translations.de,
});

let listeners: Array<() => void> = [];

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getSnapshot(): Lang {
  const stored = localStorage.getItem("lang");
  return stored === "en" || stored === "de" ? stored : "de";
}

function getServerSnapshot(): Lang {
  return "de";
}

function setStoredLang(lang: Lang) {
  localStorage.setItem("lang", lang);
  listeners.forEach((l) => l());
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider
      value={{ lang, setLang: setStoredLang, t: translations[lang] }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
