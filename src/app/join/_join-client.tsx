"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { useLang } from "@/lib/lang-context";

export default function JoinPageClient() {
  const { t } = useLang();
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/join/${trimmed}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <BackButton className="mb-6" />

        <h1 className="text-2xl font-semibold mb-1">{t.joinPage.title}</h1>
        <p className="text-sm text-zinc-500 mb-8 font-jb">
          {t.joinPage.subtitle}
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="session-code"
              className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-jb"
            >
              {t.joinPage.codeLabel}
            </label>
            <input
              id="session-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder={t.joinPage.codePlaceholder}
              maxLength={12}
              autoFocus
              className="w-full mt-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 outline-none px-3 py-2.5 text-sm font-jb uppercase tracking-widest"
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={!code.trim()}
            className="w-full bg-emerald-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 text-white dark:text-zinc-950 font-medium py-2.5 hover:bg-emerald-400 transition-colors font-jb text-sm"
          >
            {t.joinPage.joinButton}
          </button>
        </div>
      </div>
    </main>
  );
}
