"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Crown, WifiOff, Users, Eye, EyeOff, BookOpen } from "lucide-react";
import { StrategyPanel } from "@/components/StrategyPanel";
import { supabase, GAME_ID } from "@/lib/supabase";
import { fmt, isStale } from "@/lib/colors";
import { CONSTANTS } from "@/lib/simulation";
import { classifyStrategy, STRATEGIES } from "@/lib/strategies";
import type { GameRow, TeamRow } from "@/lib/types";
import { DEFAULT_GAME } from "@/lib/defaults";

export default function BeamerPage() {
  const [game, setGame] = useState<GameRow>(DEFAULT_GAME);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [showStrategies, setShowStrategies] = useState(false);

  // ─── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const sb = supabase();

    const loadInitial = async () => {
      const { data: g } = await sb
        .from("games")
        .select("*")
        .eq("id", GAME_ID)
        .single();
      if (mounted && g) setGame(g as GameRow);
      const { data: ts } = await sb
        .from("teams")
        .select("*")
        .eq("game_id", GAME_ID);
      if (mounted && ts) setTeams(ts as TeamRow[]);
    };
    loadInitial();

    const channel = sb
      .channel("beamer-page")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${GAME_ID}`,
        },
        (payload) => {
          if (mounted && payload.new) setGame(payload.new as GameRow);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `game_id=eq.${GAME_ID}`,
        },
        () => {
          sb.from("teams")
            .select("*")
            .eq("game_id", GAME_ID)
            .then(({ data }) => {
              if (mounted && data) setTeams(data as TeamRow[]);
            });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      sb.removeChannel(channel);
    };
  }, []);

  // ─── Keyboard shortcut: 'S' toggles strategy panel ────────────────────────
  const onKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "s" || e.key === "S") setShowStrategies((v) => !v);
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const sorted = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const maxScore = Math.max(1, ...sorted.map((t) => t.score ?? 0));
  const champion = sorted[0];

  return (
    <main className="min-h-screen p-6 lg:p-10 relative">
      <Link
        href="/"
        className="absolute top-3 right-3 text-[10px] text-zinc-700 hover:text-zinc-500 font-jb z-10"
      >
        ← menu
      </Link>

      <div className="max-w-7xl mx-auto">
        {/* ─── Header ────────────────────────────────────────────────── */}
        <header className="flex items-end justify-between mb-8 pb-5 border-b border-zinc-800 gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-2.5 h-2.5 bg-emerald-500 animate-pulse-mine" />
              <span className="text-xs uppercase tracking-[0.4em] text-emerald-400 font-jb">
                {game.running
                  ? "LIVE — MINING IN PROGRESS"
                  : "WAITING TO START"}
              </span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight">
              MINING <span className="text-emerald-400">SHOWDOWN</span>
            </h1>
          </div>
          <div className="flex items-end gap-6">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                Globale Last
              </div>
              <div className="text-5xl font-jb tabular-nums text-amber-400">
                {game.load}
              </div>
              <div className="text-xs text-zinc-500 font-jb">
                req/s · Start-Wallet {CONSTANTS.TEAM_BUDGET} Coins
              </div>
            </div>
            <button
              onClick={() => setShowStrategies((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 border transition-colors text-xs font-jb ${
                showStrategies
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                  : "border-zinc-700 hover:border-zinc-500 text-zinc-400"
              }`}
              title="Tastenkürzel: S"
            >
              {showStrategies ? <EyeOff size={13} /> : <Eye size={13} />}
              <BookOpen size={13} />
              <span>Strategien</span>
              <kbd className="ml-1 px-1.5 py-0.5 border border-zinc-700 text-[9px] text-zinc-500">
                S
              </kbd>
            </button>
          </div>
        </header>

        {/* ─── Empty state ───────────────────────────────────────────── */}
        {sorted.length === 0 ? (
          <div className="text-center py-32">
            <Users
              size={48}
              className="text-zinc-700 mx-auto mb-4 animate-pulse"
            />
            <div className="text-2xl text-zinc-600 font-jb">
              Warte auf Teams...
            </div>
            <div className="text-sm text-zinc-700 mt-2 font-jb">
              /team öffnen, Namen eingeben.
            </div>
          </div>
        ) : (
          <>
            {/* ─── Champion ────────────────────────────────────────── */}
            {champion && champion.score > 0 && (
              <div
                className="mb-8 border-2 p-6 lg:p-8 relative overflow-hidden"
                style={{
                  borderColor: champion.color,
                  background: `linear-gradient(90deg, ${champion.color}15, transparent)`,
                }}
              >
                <div
                  className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-jb"
                  style={{ color: champion.color }}
                >
                  <Crown size={11} /> aktueller Leader ·{" "}
                  {STRATEGIES[classifyStrategy(champion.cfg)].short}
                </div>
                <div className="flex items-center gap-6 flex-wrap">
                  <div
                    className="text-7xl lg:text-8xl font-bold font-jb tabular-nums"
                    style={{ color: champion.color }}
                  >
                    #1
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-3xl lg:text-4xl font-bold tracking-tight">
                      {champion.name}
                    </div>
                    <div className="text-xs text-zinc-500 font-jb mt-1">
                      ${(champion.cost ?? 0).toFixed(0)}/h ·{" "}
                      {champion.cpu_percent ?? 0}% CPU ·{" "}
                      {Math.round(champion.throughput ?? 0)} req/s
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-jb">
                      Score
                    </div>
                    <div
                      className="text-6xl lg:text-7xl font-bold font-jb tabular-nums"
                      style={{ color: champion.color }}
                    >
                      {fmt(champion.score)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Ranking-Liste ───────────────────────────────────── */}
            <div className="space-y-2 mb-8">
              {sorted.map((t, i) => {
                const widthPct = ((t.score ?? 0) / maxScore) * 100;
                const stale = isStale(t.last_seen);
                const inTrouble = t.over_budget || (t.dropped ?? 0) > 5;
                const strategy = STRATEGIES[classifyStrategy(t.cfg)];

                return (
                  <div
                    key={t.id}
                    className={`relative border ${
                      i === 0 ? "border-zinc-700" : "border-zinc-800"
                    } bg-zinc-900/30 overflow-hidden ${stale ? "opacity-40" : ""}`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-1000"
                      style={{
                        width: `${widthPct}%`,
                        background: `${t.color}15`,
                      }}
                    />
                    <div className="relative flex items-center gap-4 px-5 py-4">
                      <div
                        className="text-3xl font-bold font-jb tabular-nums w-12"
                        style={{ color: t.color }}
                      >
                        {i + 1}
                      </div>
                      <div
                        className="w-1 h-10"
                        style={{ background: t.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl font-semibold truncate">
                            {t.name}
                          </span>
                          {showStrategies && (
                            <span
                              className="text-[10px] font-jb uppercase tracking-widest px-1.5 py-0.5 border"
                              style={{
                                color: strategy.color,
                                borderColor: `${strategy.color}60`,
                              }}
                            >
                              {strategy.short}
                            </span>
                          )}
                          {stale && (
                            <WifiOff size={13} className="text-zinc-600" />
                          )}
                          {t.over_budget && (
                            <span className="text-[10px] uppercase tracking-widest text-red-400 font-jb">
                              BANKRUPT
                            </span>
                          )}
                          {!t.over_budget && (t.dropped ?? 0) > 5 && (
                            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-jb">
                              DROPS
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-zinc-500 font-jb mt-1 flex-wrap">
                          <span>${(t.cost ?? 0).toFixed(0)}/h</span>
                          <span>{t.cfg.nodeCount}× node</span>
                          <span>
                            {t.cfg.cpuPerNode}c · {t.cfg.ramPerNode}gb
                          </span>
                          {t.cfg.loadBalancer && (
                            <span className="text-emerald-400">+LB</span>
                          )}
                          {t.cfg.shards > 1 && (
                            <span className="text-violet-400">
                              {t.cfg.shards} shards
                            </span>
                          )}
                          <span>{Math.round(t.response_time ?? 0)} ms</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-3xl lg:text-4xl font-bold font-jb tabular-nums"
                          style={{ color: inTrouble ? "#ef4444" : t.color }}
                        >
                          {fmt(t.score)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-jb">
                          {Math.round(t.throughput ?? 0)}/s
                          {(t.dropped ?? 0) > 1 && (
                            <span className="text-red-400 ml-1.5">
                              −{Math.round(t.dropped)}
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[10px] font-jb tabular-nums ${(t.wallet ?? 100) < 20 ? "text-amber-400" : "text-zinc-600"}`}
                        >
                          {(t.wallet ?? 100).toFixed(0)} coins
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── Optional: Strategien ────────────────────────────── */}
            {showStrategies && <StrategyPanel teams={teams} />}
          </>
        )}

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <footer className="mt-10 flex items-center justify-between text-[10px] text-zinc-700 font-jb">
          <span>
            ASE2 Scalability Lab · {sorted.length} team
            {sorted.length !== 1 ? "s" : ""}
          </span>
          <span>
            {game.running ? "live" : "paused"} · score = kumulierte erfolgreich
            verarbeitete requests
          </span>
        </footer>
      </div>
    </main>
  );
}
