"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Crown,
  WifiOff,
  Users,
  Eye,
  EyeOff,
  BookOpen,
  Timer,
  Trophy,
} from "lucide-react";
import { StrategyPanel } from "@/components/StrategyPanel";
import { supabase, GAME_ID } from "@/lib/supabase";
import { fmt, isStale } from "@/lib/colors";
import { CONSTANTS, computeElapsed } from "@/lib/simulation";
import { classifyStrategy, STRATEGIES } from "@/lib/strategies";
import type { GameRow, TeamRow, LoadSnapshot } from "@/lib/types";
import { DEFAULT_GAME } from "@/lib/defaults";
import { useLang } from "@/lib/lang-context";

const GRAPH_POINTS = 120;

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BeamerPage() {
  const { lang, t } = useLang();
  const [game, setGame] = useState<GameRow>(DEFAULT_GAME);
  const gameRef = useRef<GameRow>(DEFAULT_GAME);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [showStrategies, setShowStrategies] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [loadHistory, setLoadHistory] = useState<number[]>([]);

  // ─── Timer-Tick (1s) — nur für die Uhr, kein DB-Polling ─────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
      if (mounted && g) {
        const row = g as GameRow;
        gameRef.current = row;
        setGame(row);
      }
      const { data: ts } = await sb
        .from("teams")
        .select("*")
        .eq("game_id", GAME_ID);
      if (mounted && ts) setTeams(ts as TeamRow[]);

      // Load history from DB — persistent across reloads
      const { data: snaps } = await sb
        .from("load_snapshots")
        .select("load")
        .eq("game_id", GAME_ID)
        .order("recorded_at", { ascending: false })
        .limit(GRAPH_POINTS);
      if (mounted) {
        if (snaps && snaps.length > 0) {
          // oldest first so the graph flows left → right
          setLoadHistory(snaps.map((s) => s.load).reverse());
        } else if (g) {
          // No snapshots yet — pre-seed so graph is visible immediately
          setLoadHistory(Array(5).fill((g as GameRow).load));
        }
      }
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
          if (mounted && payload.new) {
            const g = payload.new as GameRow;
            gameRef.current = g;
            setGame(g);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "load_snapshots",
          filter: `game_id=eq.${GAME_ID}`,
        },
        (payload) => {
          if (!mounted || !payload.new) return;
          const snap = payload.new as LoadSnapshot;
          // Update live load display
          gameRef.current = { ...gameRef.current, load: snap.load };
          setGame((prev) => ({ ...prev, load: snap.load }));
          // Append to graph history
          setLoadHistory((prev) => {
            const next = [...prev, snap.load];
            return next.length > GRAPH_POINTS
              ? next.slice(-GRAPH_POINTS)
              : next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "teams",
          filter: `game_id=eq.${GAME_ID}`,
        },
        (payload) => {
          if (mounted && payload.new)
            setTeams((prev) => [...prev, payload.new as TeamRow]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "teams",
          filter: `game_id=eq.${GAME_ID}`,
        },
        (payload) => {
          if (mounted && payload.new)
            setTeams((prev) =>
              prev.map((t) =>
                t.id === (payload.new as TeamRow).id
                  ? (payload.new as TeamRow)
                  : t,
              ),
            );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "teams",
          filter: `game_id=eq.${GAME_ID}`,
        },
        (payload) => {
          if (mounted && payload.old)
            setTeams((prev) =>
              prev.filter((t) => t.id !== (payload.old as TeamRow).id),
            );
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
  const maxScore = Math.max(1, ...sorted.map((tm) => tm.score ?? 0));
  const champion = sorted[0];

  const gameDuration =
    game.game_duration ?? DEFAULT_GAME.game_duration ?? CONSTANTS.GAME_DURATION;
  const elapsed = computeElapsed(game.started_at, game.running, now);
  const timeLeft = gameDuration - elapsed;
  const gameEnded =
    !game.running && !!game.started_at && elapsed >= gameDuration;

  // Graph: x-Koordinaten relativ zur tatsächlichen Datenpunktanzahl
  const graphMax = Math.max(1, ...loadHistory);
  const graphPoints = loadHistory
    .map((v, i) => {
      const x = (i / Math.max(1, loadHistory.length - 1)) * 100;
      const y = 100 - (v / graphMax) * 95;
      return `${x},${y}`;
    })
    .join(" ");

  // suppress unused warning — lang is used implicitly via t
  void lang;

  return (
    <main className="min-h-screen p-6 lg:p-10 relative">
      <Link
        href="/"
        className="absolute top-3 right-3 text-[10px] text-zinc-400 dark:text-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-500 font-jb z-10"
      >
        {t.common.back}
      </Link>

      <div className="max-w-7xl mx-auto">
        {/* ─── Header: Titel + Strategien-Button ─────────────── */}
        <header className="flex items-end justify-between mb-6 pb-5 border-b border-zinc-200 dark:border-zinc-800 gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className={`w-2.5 h-2.5 ${game.running ? "bg-emerald-500 animate-pulse-mine" : gameEnded ? "bg-amber-500" : "bg-zinc-400 dark:bg-zinc-600"}`}
              />
              <span
                className={`text-xs uppercase tracking-[0.4em] font-jb ${game.running ? "text-emerald-500 dark:text-emerald-400" : gameEnded ? "text-amber-500 dark:text-amber-400" : "text-zinc-400 dark:text-zinc-600"}`}
              >
                {gameEnded
                  ? "GAME OVER"
                  : game.running
                    ? t.beamer.live
                    : t.beamer.waiting}
              </span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight">
              MINING{" "}
              <span className="text-emerald-500 dark:text-emerald-400">
                SHOWDOWN
              </span>
            </h1>
          </div>
          <div className="flex items-end gap-6">
            {/* Timer */}
            {game.started_at && (
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end text-[11px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                  <Timer size={11} /> Timer
                </div>
                <div
                  className={`text-5xl font-jb tabular-nums ${
                    gameEnded
                      ? "text-amber-500 dark:text-amber-400"
                      : timeLeft < 60
                        ? "text-red-500 dark:text-red-400"
                        : timeLeft < 120
                          ? "text-amber-500 dark:text-amber-400"
                          : "text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  {gameEnded ? "0:00" : formatTime(timeLeft)}
                </div>
                <div className="text-xs text-zinc-500 font-jb">
                  {gameEnded ? "beendet" : game.running ? "läuft" : "pausiert"}
                </div>
              </div>
            )}
            <button
              onClick={() => setShowStrategies((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 border transition-colors text-xs font-jb ${
                showStrategies
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 text-zinc-500 dark:text-zinc-400"
              }`}
              title="Tastenkürzel: S"
            >
              {showStrategies ? <EyeOff size={13} /> : <Eye size={13} />}
              <BookOpen size={13} />
              <span>{t.beamer.strategies}</span>
              <kbd className="ml-1 px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 text-[9px] text-zinc-500">
                S
              </kbd>
            </button>
          </div>
        </header>

        {/* ─── Load + Graph: unterhalb Titel, oberhalb Rangliste ─────── */}
        <div className="mb-6 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4">
          <div className="flex items-start gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                {t.beamer.globalLoad}
              </div>
              <div className="text-4xl font-jb tabular-nums text-amber-500 dark:text-amber-400">
                {game.load}
              </div>
              <div className="text-xs text-zinc-500 font-jb mt-0.5">
                req/s · {t.beamer.startWallet} {CONSTANTS.TEAM_BUDGET} CHF
              </div>
            </div>
            {loadHistory.length > 2 && (
              <div className="flex-1">
                <div className="flex justify-between text-[9px] text-zinc-400 dark:text-zinc-600 font-jb mb-1">
                  <span>←120s</span>
                  <span>{graphMax} req/s max</span>
                </div>
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="w-full h-16"
                >
                  {/* Gridline bei 50% */}
                  <line
                    x1="0"
                    y1="52.5"
                    x2="100"
                    y2="52.5"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-zinc-300 dark:text-zinc-700"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={graphPoints}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* Aktueller Punkt */}
                  {loadHistory.length > 0 && (
                    <circle
                      cx="100"
                      cy={
                        100 -
                        (loadHistory[loadHistory.length - 1] / graphMax) * 95
                      }
                      r="2"
                      fill="#f59e0b"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* ─── Empty state ───────────────────────────────────────────── */}
        {sorted.length === 0 ? (
          <div className="text-center py-32">
            <Users
              size={48}
              className="text-zinc-300 dark:text-zinc-700 mx-auto mb-4 animate-pulse"
            />
            <div className="text-2xl text-zinc-400 dark:text-zinc-600 font-jb">
              {t.beamer.waitingTeams}
            </div>
            <div className="text-sm text-zinc-400 dark:text-zinc-700 mt-2 font-jb">
              {t.beamer.waitingHint}
            </div>
          </div>
        ) : gameEnded ? (
          /* ─── End Screen: Top-3 Podium ───────────────────────────── */
          <>
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy
                  size={20}
                  className="text-amber-500 dark:text-amber-400"
                />
                <span className="text-xs uppercase tracking-[0.4em] text-amber-500 dark:text-amber-400 font-jb">
                  Final Results
                </span>
                <Trophy
                  size={20}
                  className="text-amber-500 dark:text-amber-400"
                />
              </div>
            </div>

            {/* Podium: #2 links, #1 Mitte (höher), #3 rechts */}
            <div className="flex items-end justify-center gap-3 mb-8">
              {/* #2 */}
              {sorted[1] && (
                <div
                  className="flex-1 max-w-xs border-2 p-5 text-center"
                  style={{ borderColor: sorted[1].color }}
                >
                  <div className="text-2xl font-bold font-jb text-zinc-400 dark:text-zinc-500 mb-2">
                    #2
                  </div>
                  <div
                    className="w-3 h-3 mx-auto mb-2"
                    style={{ background: sorted[1].color }}
                  />
                  <div className="text-xl font-semibold truncate">
                    {sorted[1].name}
                  </div>
                  <div
                    className="text-3xl font-bold font-jb tabular-nums mt-1"
                    style={{ color: sorted[1].color }}
                  >
                    {fmt(sorted[1].score)}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-jb mt-1">
                    coins mined
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-600 font-jb mt-0.5">
                    {STRATEGIES[classifyStrategy(sorted[1].cfg)].short}
                  </div>
                </div>
              )}
              {/* #1 — grösser */}
              {sorted[0] && (
                <div
                  className="flex-1 max-w-sm border-2 p-6 text-center relative overflow-hidden"
                  style={{
                    borderColor: sorted[0].color,
                    background: `linear-gradient(180deg, ${sorted[0].color}20, transparent)`,
                  }}
                >
                  <Crown
                    size={20}
                    className="mx-auto mb-2"
                    style={{ color: sorted[0].color }}
                  />
                  <div
                    className="text-4xl font-bold font-jb mb-2"
                    style={{ color: sorted[0].color }}
                  >
                    #1
                  </div>
                  <div
                    className="w-4 h-4 mx-auto mb-2"
                    style={{ background: sorted[0].color }}
                  />
                  <div className="text-2xl font-semibold truncate">
                    {sorted[0].name}
                  </div>
                  <div
                    className="text-5xl font-bold font-jb tabular-nums mt-2"
                    style={{ color: sorted[0].color }}
                  >
                    {fmt(sorted[0].score)}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-jb mt-1">
                    coins mined
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-600 font-jb mt-0.5">
                    {STRATEGIES[classifyStrategy(sorted[0].cfg)].short}
                  </div>
                </div>
              )}
              {/* #3 */}
              {sorted[2] && (
                <div
                  className="flex-1 max-w-xs border-2 p-4 text-center"
                  style={{ borderColor: sorted[2].color }}
                >
                  <div className="text-2xl font-bold font-jb text-zinc-400 dark:text-zinc-500 mb-2">
                    #3
                  </div>
                  <div
                    className="w-3 h-3 mx-auto mb-2"
                    style={{ background: sorted[2].color }}
                  />
                  <div className="text-xl font-semibold truncate">
                    {sorted[2].name}
                  </div>
                  <div
                    className="text-3xl font-bold font-jb tabular-nums mt-1"
                    style={{ color: sorted[2].color }}
                  >
                    {fmt(sorted[2].score)}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-jb mt-1">
                    coins mined
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-600 font-jb mt-0.5">
                    {STRATEGIES[classifyStrategy(sorted[2].cfg)].short}
                  </div>
                </div>
              )}
            </div>

            {/* Restliche Teams */}
            {sorted.length > 3 && (
              <div className="space-y-1 mb-8">
                {sorted.slice(3).map((tm, i) => (
                  <div
                    key={tm.id}
                    className="flex items-center gap-4 text-sm font-jb text-zinc-500 py-2 border-b border-zinc-200/50 dark:border-zinc-800/50"
                  >
                    <span className="w-6 tabular-nums">#{i + 4}</span>
                    <span
                      className="w-2.5 h-2.5"
                      style={{ background: tm.color }}
                    />
                    <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                      {tm.name}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {STRATEGIES[classifyStrategy(tm.cfg)].short}
                    </span>
                    <span className="tabular-nums">{fmt(tm.score)}</span>
                  </div>
                ))}
              </div>
            )}

            {showStrategies && <StrategyPanel teams={teams} />}
          </>
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
                  <Crown size={11} /> {t.beamer.currentLeader} ·{" "}
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
                      Coins Mined
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
              {sorted.map((tm, i) => {
                const widthPct = ((tm.score ?? 0) / maxScore) * 100;
                const stale = isStale(tm.last_seen);
                const inTrouble = tm.over_budget || (tm.dropped ?? 0) > 5;
                const strategy = STRATEGIES[classifyStrategy(tm.cfg)];

                return (
                  <div
                    key={tm.id}
                    className={`relative border ${
                      i === 0
                        ? "border-zinc-300 dark:border-zinc-700"
                        : "border-zinc-200 dark:border-zinc-800"
                    } bg-zinc-100/50 dark:bg-zinc-900/30 overflow-hidden ${stale ? "opacity-40" : ""}`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-1000"
                      style={{
                        width: `${widthPct}%`,
                        background: `${tm.color}15`,
                      }}
                    />
                    <div className="relative flex items-center gap-4 px-5 py-4">
                      <div
                        className="text-3xl font-bold font-jb tabular-nums w-12"
                        style={{ color: tm.color }}
                      >
                        {i + 1}
                      </div>
                      <div
                        className="w-1 h-10"
                        style={{ background: tm.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl font-semibold truncate">
                            {tm.name}
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
                            <WifiOff
                              size={13}
                              className="text-zinc-400 dark:text-zinc-600"
                            />
                          )}
                          {tm.over_budget && (
                            <span className="text-[10px] uppercase tracking-widest text-red-500 dark:text-red-400 font-jb">
                              BANKRUPT
                            </span>
                          )}
                          {!tm.over_budget && (tm.dropped ?? 0) > 5 && (
                            <span className="text-[10px] uppercase tracking-widest text-amber-500 dark:text-amber-400 font-jb">
                              DROPS
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-zinc-500 font-jb mt-1 flex-wrap">
                          <span>${(tm.cost ?? 0).toFixed(0)}/h</span>
                          <span>{tm.cfg.nodeCount}× node</span>
                          <span>
                            {tm.cfg.cpuPerNode}c · {tm.cfg.ramPerNode}gb
                          </span>
                          {tm.cfg.loadBalancer && (
                            <span className="text-emerald-500 dark:text-emerald-400">
                              +LB
                            </span>
                          )}
                          {tm.cfg.shards > 1 && (
                            <span className="text-violet-500 dark:text-violet-400">
                              {tm.cfg.shards} shards
                            </span>
                          )}
                          <span>{Math.round(tm.response_time ?? 0)} ms</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-3xl lg:text-4xl font-bold font-jb tabular-nums"
                          style={{ color: inTrouble ? "#ef4444" : tm.color }}
                        >
                          {fmt(tm.score)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-jb">
                          {Math.round(tm.throughput ?? 0)}/s
                          {(tm.dropped ?? 0) > 1 && (
                            <span className="text-red-500 dark:text-red-400 ml-1.5">
                              −{Math.round(tm.dropped)}
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[10px] font-jb tabular-nums ${(tm.wallet ?? 100) < 20 ? "text-amber-500 dark:text-amber-400" : "text-zinc-400 dark:text-zinc-600"}`}
                        >
                          {(tm.wallet ?? 100).toFixed(0)} CHF
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
        <footer className="mt-10 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-700 font-jb">
          <span>
            {t.beamer.labFooter} · {t.beamer.teams(sorted.length)}
          </span>
          <span>
            {gameEnded
              ? "beendet"
              : game.running
                ? t.beamer.liveStatus
                : t.beamer.pausedStatus}{" "}
            · {t.beamer.scoreFooter}
          </span>
        </footer>
      </div>
    </main>
  );
}
