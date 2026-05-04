"use client";

import { STRATEGIES, STRATEGY_ORDER, classifyStrategy } from "@/lib/strategies";
import type { TeamRow, StrategyKey } from "@/lib/types";
import { fmt } from "@/lib/colors";
import { useLang } from "@/lib/lang-context";

type Props = {
  teams: TeamRow[];
};

export function StrategyPanel({ teams }: Props) {
  const { lang, t } = useLang();

  const grouped: Record<StrategyKey, TeamRow[]> = {
    baseline: [],
    vertical: [],
    noLB: [],
    loadBalanced: [],
    combined: [],
    sharded: [],
  };
  teams.forEach((tm) => grouped[classifyStrategy(tm.cfg)].push(tm));

  const scoreByStrategy = (key: StrategyKey) =>
    grouped[key].reduce((sum, tm) => sum + (tm.score ?? 0), 0);

  return (
    <section className="border border-zinc-800 bg-zinc-900/30 p-5 lg:p-6">
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-zinc-800">
        <h2 className="text-lg lg:text-xl font-semibold tracking-tight">
          {t.strategyPanel.title}{" "}
          <span className="text-zinc-500 text-xs font-jb font-normal">
            {t.strategyPanel.subtitle}
          </span>
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb">
          {t.strategyPanel.liveClassified(teams.length)}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {STRATEGY_ORDER.map((key) => {
          const s = STRATEGIES[key];
          const teamsHere = grouped[key];
          const aggScore = scoreByStrategy(key);
          const isActive = teamsHere.length > 0;

          return (
            <div
              key={key}
              className="border bg-zinc-950/40 p-4 transition-all"
              style={{
                borderColor: isActive ? s.color : "#27272a",
                boxShadow: isActive ? `inset 0 0 0 1px ${s.color}40` : "none",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2" style={{ background: s.color }} />
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: isActive ? s.color : "#a1a1aa" }}
                  >
                    {s.label[lang]}
                  </h3>
                </div>
                {isActive && (
                  <span
                    className="text-[10px] font-jb tabular-nums"
                    style={{ color: s.color }}
                  >
                    {teamsHere.length}× · {fmt(aggScore)}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-zinc-400 leading-snug font-jb mb-2">
                {s.desc[lang]}
              </p>

              <div className="text-[10px] font-jb space-y-0.5 mb-2">
                <div className="text-emerald-500/70">
                  <span className="text-zinc-600">+ </span>
                  {s.pros[lang]}
                </div>
                <div className="text-red-500/70">
                  <span className="text-zinc-600">− </span>
                  {s.cons[lang]}
                </div>
              </div>

              {teamsHere.length > 0 && (
                <div className="pt-2 border-t border-zinc-800 space-y-1">
                  {teamsHere
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 4)
                    .map((tm) => (
                      <div
                        key={tm.id}
                        className="flex items-center gap-1.5 text-[10px] font-jb"
                      >
                        <span
                          className="w-1.5 h-1.5 shrink-0"
                          style={{ background: tm.color }}
                        />
                        <span className="truncate text-zinc-300">
                          {tm.name}
                        </span>
                        <span className="ml-auto tabular-nums text-zinc-500">
                          {fmt(tm.score)}
                        </span>
                      </div>
                    ))}
                  {teamsHere.length > 4 && (
                    <div className="text-[10px] text-zinc-600 font-jb">
                      {t.strategyPanel.more(teamsHere.length - 4)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-zinc-600 font-jb leading-relaxed">
        {t.strategyPanel.footer}
      </p>
    </section>
  );
}
