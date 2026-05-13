"use client";

import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { Sun, Moon } from "lucide-react";

const btnClass =
  "px-2.5 py-1 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-400 text-[10px] font-jb text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors bg-white dark:bg-zinc-950 flex items-center gap-1";

export function LangToggle() {
  const { lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1">
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className={btnClass}
        title={
          theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"
        }
      >
        {theme === "light" ? <Moon size={11} /> : <Sun size={11} />}
      </button>
      <button
        onClick={() => setLang(lang === "de" ? "en" : "de")}
        className={btnClass}
        title={lang === "de" ? "Switch to English" : "Zu Deutsch wechseln"}
      >
        {lang === "de" ? "EN" : "DE"}
      </button>
    </div>
  );
}
