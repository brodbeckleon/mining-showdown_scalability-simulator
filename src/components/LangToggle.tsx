"use client";

import { useLang } from "@/lib/lang-context";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === "de" ? "en" : "de")}
      className="fixed bottom-4 right-4 z-50 px-2.5 py-1 border border-zinc-700 hover:border-zinc-400 text-[10px] font-jb text-zinc-500 hover:text-zinc-200 transition-colors bg-zinc-950"
      title={lang === "de" ? "Switch to English" : "Zu Deutsch wechseln"}
    >
      {lang === "de" ? "EN" : "DE"}
    </button>
  );
}
