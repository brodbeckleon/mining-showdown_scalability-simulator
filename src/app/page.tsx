"use client";

import Link from "next/link";
import { Tv, Gamepad2, Users, GraduationCap } from "lucide-react";
import { CONSTANTS } from "@/lib/simulation";
import { useLang } from "@/lib/lang-context";

export default function HomePage() {
  const { t } = useLang();

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 bg-emerald-500 animate-pulse-mine" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-500 dark:text-emerald-400 font-jb">
              {t.home.tagline}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Mining Farm{" "}
            <span className="text-emerald-500 dark:text-emerald-400">
              Showdown
            </span>
          </h1>
          <p className="text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            {t.home.subtitle}
          </p>
        </div>

        {/* Private session */}
        <Link
          href="/create"
          className="group block border border-amber-400/40 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-5 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap size={22} className="text-amber-500 dark:text-amber-400" />
              <div>
                <h2 className="text-base font-semibold">Create Private Session</h2>
                <p className="text-xs text-zinc-500 font-jb mt-0.5">
                  For teachers — generates a unique join link &amp; QR code for your class.
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-jb text-amber-500 dark:text-amber-400 border border-amber-400/50 px-2 py-0.5 shrink-0">
              New
            </span>
          </div>
        </Link>

        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/beamer"
            className="group border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-6 hover:border-emerald-500 transition-all"
          >
            <Tv
              size={28}
              className="text-emerald-500 dark:text-emerald-400 mb-4"
            />
            <h2 className="text-lg font-semibold mb-1.5">Beamer</h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-jb">
              {t.home.beamerDesc}
            </p>
          </Link>

          <Link
            href="/team"
            className="group border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-6 hover:border-emerald-500 transition-all"
          >
            <Gamepad2
              size={28}
              className="text-emerald-500 dark:text-emerald-400 mb-4"
            />
            <h2 className="text-lg font-semibold mb-1.5">{t.home.teamTitle}</h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-jb">
              {t.home.teamDesc}
            </p>
          </Link>

          <Link
            href="/host"
            className="group border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-6 hover:border-amber-500 transition-all"
          >
            <Users
              size={28}
              className="text-amber-500 dark:text-amber-400 mb-4"
            />
            <h2 className="text-lg font-semibold mb-1.5">Host</h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-jb">
              {t.home.hostDesc}
            </p>
          </Link>
        </div>

        <div className="mt-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/30 dark:bg-zinc-900/20 p-4">
          <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-2">
            {t.home.howToPlay}
          </h3>
          <ol className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5 font-jb">
            <li>
              <span className="text-emerald-500 dark:text-emerald-400">1.</span>{" "}
              {t.home.step1}
            </li>
            <li>
              <span className="text-emerald-500 dark:text-emerald-400">2.</span>{" "}
              {t.home.step2}
            </li>
            <li>
              <span className="text-emerald-500 dark:text-emerald-400">3.</span>{" "}
              {t.home.step3}
            </li>
            <li>
              <span className="text-emerald-500 dark:text-emerald-400">4.</span>{" "}
              {t.home.step4(CONSTANTS.TEAM_BUDGET)}
            </li>
            <li>
              <span className="text-emerald-500 dark:text-emerald-400">5.</span>{" "}
              {t.home.step5}
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
