"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Cpu,
  MemoryStick,
  Database,
  Network,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Server,
  Coins,
  Play,
  Square,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Slider } from "@/components/Slider";
import { Toggle } from "@/components/Toggle";
import { Bar } from "@/components/Bar";
import { ArchitectureViz } from "@/components/ArchitectureViz";
import { computeMetrics, CONSTANTS } from "@/lib/simulation";
import { fmt } from "@/lib/colors";
import type { TeamConfig } from "@/lib/types";
import {
  createBots,
  getBotConfig,
  DIFFICULTY_CONFIG,
  STRATEGY_LABELS,
  type BotDifficulty,
  type BotState,
} from "@/lib/bots";

const DEFAULT_SOLO_CFG: TeamConfig = {
  cpuPerNode: 2,
  ramPerNode: 2,
  nodeCount: 1,
  loadBalancer: false,
  shards: 1,
};

const PLAYER_COLOR = "#10b981";
const INITIAL_LOAD = 100;
const MAX_LOAD = 2000;

type Phase = "setup" | "playing" | "ended";

export default function SoloPageClient() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [playerName, setPlayerName] = useState("You");

  // Player game state
  const [cfg, setCfg] = useState<TeamConfig>(DEFAULT_SOLO_CFG);
  const [score, setScore] = useState(0);
  const [wallet, setWallet] = useState<number>(CONSTANTS.TEAM_BUDGET);
  const cfgRef = useRef<TeamConfig>(DEFAULT_SOLO_CFG);
  const scoreRef = useRef(0);
  const walletRef = useRef<number>(CONSTANTS.TEAM_BUDGET);
  const lastTickRef = useRef<number | null>(null);

  // World state
  const [load, setLoad] = useState(INITIAL_LOAD);
  const loadRef = useRef(INITIAL_LOAD);
  const [elapsed, setElapsed] = useState(0);
  const [bots, setBots] = useState<BotState[]>([]);

  // Keep refs in sync
  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // ─── Start / reset ────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const name = playerName.trim() || "You";
    setPlayerName(name);
    setCfg({ ...DEFAULT_SOLO_CFG });
    cfgRef.current = { ...DEFAULT_SOLO_CFG };
    scoreRef.current = 0;
    walletRef.current = CONSTANTS.TEAM_BUDGET;
    setScore(0);
    setWallet(CONSTANTS.TEAM_BUDGET);
    setLoad(INITIAL_LOAD);
    loadRef.current = INITIAL_LOAD;
    setElapsed(0);
    lastTickRef.current = null;
    const initialBots = createBots(difficulty);
    setBots(initialBots);
    setPhase("playing");
  }, [difficulty, playerName]);

  // ─── Score tick (every 1.5s) ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const now = Date.now();
      const dt = lastTickRef.current
        ? Math.min((now - lastTickRef.current) / 1000, 10)
        : 1.5;
      lastTickRef.current = now;

      // Player
      const m = computeMetrics(cfgRef.current, loadRef.current);
      if (walletRef.current > 0) {
        const netPerSec =
          m.throughput * CONSTANTS.EARN_RATE -
          m.cost * CONSTANTS.SPEND_RATE;
        walletRef.current = Math.max(0, walletRef.current + netPerSec * dt);
        scoreRef.current += m.throughput * dt;
        setScore(scoreRef.current);
        setWallet(walletRef.current);
      }

      // Bots
      setBots((prev) =>
        prev.map((bot) => {
          if (bot.wallet <= 0) return bot;
          const bm = computeMetrics(bot.cfg, loadRef.current);
          const net =
            bm.throughput * CONSTANTS.EARN_RATE -
            bm.cost * CONSTANTS.SPEND_RATE;
          return {
            ...bot,
            wallet: Math.max(0, bot.wallet + net * dt),
            score: bot.score + bm.throughput * dt,
          };
        }),
      );
    }, 1500);
    return () => clearInterval(id);
  }, [phase]);

  // ─── Elapsed timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ─── Load ramp ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const dc = DIFFICULTY_CONFIG[difficulty];
    const id = setInterval(() => {
      setLoad((prev) => {
        const next = Math.min(MAX_LOAD, prev + dc.loadStep);
        loadRef.current = next;
        return next;
      });
    }, dc.loadIntervalMs);
    return () => clearInterval(id);
  }, [phase, difficulty]);

  // ─── Bot upgrades ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const dc = DIFFICULTY_CONFIG[difficulty];
    const id = setInterval(() => {
      setBots((prev) =>
        prev.map((bot) => {
          const newStep = bot.upgradeStep + 1;
          return {
            ...bot,
            upgradeStep: newStep,
            cfg: getBotConfig(bot, newStep, difficulty),
          };
        }),
      );
    }, dc.upgradeIntervalMs);
    return () => clearInterval(id);
  }, [phase, difficulty]);

  // ─── Derived ──────────────────────────────────────────────────────────────
  const metrics = useMemo(
    () => computeMetrics(cfg, load),
    [cfg, load],
  );
  const bankrupt = wallet <= 0;
  const earnRate =
    metrics.throughput * CONSTANTS.EARN_RATE -
    metrics.cost * CONSTANTS.SPEND_RATE;

  const allEntries = useMemo(() => {
    const entries = [
      {
        id: "player",
        name: playerName,
        score,
        wallet,
        color: PLAYER_COLOR,
        isPlayer: true,
        strategy: null as null | BotState["strategy"],
        bankrupt,
      },
      ...bots.map((b) => ({
        id: b.id,
        name: b.name,
        score: b.score,
        wallet: b.wallet,
        color: b.color,
        isPlayer: false,
        strategy: b.strategy,
        bankrupt: b.wallet <= 0,
      })),
    ];
    return entries.sort((a, b) => b.score - a.score);
  }, [playerName, score, wallet, bots, bankrupt]);

  const playerRank = allEntries.findIndex((e) => e.id === "player") + 1;

  const update = (patch: Partial<TeamConfig>) =>
    setCfg((prev) => ({ ...prev, ...patch }));

  const elapsedStr = (() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  })();

  const statusClass = bankrupt
    ? "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400"
    : earnRate < 0
      ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : metrics.dropped > 1
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

  const statusText = bankrupt
    ? "BANKRUPT — Infrastructure offline. Score frozen."
    : earnRate < 0
      ? `Budget draining (${earnRate.toFixed(3)} CHF/s) — infra too expensive for current throughput.`
      : metrics.dropped > 1
        ? `Bottleneck: ${Math.round(metrics.dropped)} req/s dropped.`
        : "System running clean. Mining active.";

  // ─── Setup screen ─────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <BackButton className="mb-6" />

          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-emerald-500" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-500 dark:text-emerald-400 font-jb">
              Single Player
            </span>
          </div>
          <h1 className="text-2xl font-semibold mb-1">Solo Mode</h1>
          <p className="text-xs text-zinc-500 font-jb mb-8">
            Race against AI bots. Build the most efficient mining
            infrastructure as the load ramps up — outscale them to win.
          </p>

          {/* Player name */}
          <div className="mb-6">
            <label
              htmlFor="player-name"
              className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-jb"
            >
              Your Name
            </label>
            <input
              id="player-name"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startGame()}
              placeholder="You"
              maxLength={20}
              autoFocus
              className="w-full mt-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 outline-none px-3 py-2.5 text-sm font-jb"
            />
          </div>

          {/* Difficulty */}
          <div className="mb-8">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-jb mb-2">
              Difficulty
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["easy", "medium", "hard"] as BotDifficulty[]).map((d) => {
                const dc = DIFFICULTY_CONFIG[d];
                const selected = difficulty === d;
                const selectedCls =
                  d === "easy"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : d === "medium"
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-red-500 bg-red-500/10";
                const labelCls =
                  d === "easy"
                    ? "text-emerald-500 dark:text-emerald-400"
                    : d === "medium"
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-red-500 dark:text-red-400";
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`border p-4 text-left transition-all ${
                      selected
                        ? selectedCls
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold mb-1 ${
                        selected
                          ? labelCls
                          : "text-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {dc.label}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-jb leading-relaxed">
                      {dc.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={startGame}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white dark:text-zinc-950 font-medium py-3 hover:bg-emerald-400 transition-colors font-jb text-sm"
          >
            <Play size={14} />
            Start Game
          </button>
        </div>
      </main>
    );
  }

  // ─── Playing + results screen ─────────────────────────────────────────────
  return (
    <>
      {/* End screen overlay */}
      {phase === "ended" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <Trophy size={36} className="mx-auto mb-3 text-amber-400" />
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
              Game Over
            </div>
            <div className="text-xs text-zinc-500 font-jb mb-5">
              Time: {elapsedStr} · {DIFFICULTY_CONFIG[difficulty].label}
            </div>

            <div className="space-y-1 mb-6 text-left">
              {allEntries.map((e, i) => (
                <div
                  key={e.id}
                  className={`flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-900 text-sm font-jb ${
                    e.isPlayer
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-zinc-700 dark:text-zinc-300"
                  } ${e.bankrupt ? "opacity-50" : ""}`}
                >
                  <span className="w-5 text-zinc-500">#{i + 1}</span>
                  <span
                    className="w-2 h-2 shrink-0"
                    style={{ background: e.color }}
                  />
                  <span className="flex-1 truncate">{e.name}</span>
                  {e.strategy && (
                    <span className="text-[10px] text-zinc-400">
                      {STRATEGY_LABELS[e.strategy]}
                    </span>
                  )}
                  <span className="tabular-nums">{fmt(e.score)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPhase("setup");
                }}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 py-2 text-xs font-jb hover:border-zinc-500 dark:hover:border-zinc-400 transition-colors"
              >
                Play Again
              </button>
              <Link
                href="/"
                className="flex-1 bg-emerald-500 text-white dark:text-zinc-950 py-2 text-xs font-jb text-center hover:bg-emerald-400 transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen p-3 md:p-5">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-emerald-500" />
              <div>
                <div className="text-sm font-semibold">{playerName}</div>
                <div className="text-[10px] text-zinc-500 font-jb">
                  <span className="text-emerald-500 dark:text-emerald-400">
                    ● solo
                  </span>
                  {" · "}
                  <span
                    className={
                      difficulty === "easy"
                        ? "text-emerald-500 dark:text-emerald-400"
                        : difficulty === "medium"
                          ? "text-amber-500 dark:text-amber-400"
                          : "text-red-500 dark:text-red-400"
                    }
                  >
                    {DIFFICULTY_CONFIG[difficulty].label}
                  </span>
                  {" · "}load: {load} req/s
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-jb tabular-nums text-zinc-500 dark:text-zinc-400">
                {elapsedStr}
              </div>
              <button
                onClick={() => setPhase("ended")}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/50 hover:bg-red-500/10 text-red-500 dark:text-red-400 transition-colors text-xs font-jb"
              >
                <Square size={11} />
                End Game
              </button>
            </div>
          </header>

          {/* Status bar */}
          <div
            className={`mb-4 border px-3 py-2 flex items-center gap-2 text-xs font-jb ${statusClass}`}
          >
            {bankrupt ? (
              <AlertTriangle size={13} />
            ) : (
              <CheckCircle2 size={13} />
            )}
            <span className="flex-1">{statusText}</span>
            <span className="text-zinc-500">
              Rank #{playerRank}/{allEntries.length}
            </span>
          </div>

          <div className="grid lg:grid-cols-12 gap-4">
            {/* Config column */}
            <div
              className={`lg:col-span-4 space-y-3 ${phase === "ended" ? "pointer-events-none opacity-40" : ""}`}
            >
              {/* Budget */}
              <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins
                      size={18}
                      className="text-emerald-500 dark:text-emerald-400"
                    />
                    <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                      CHF Budget
                    </h2>
                  </div>
                  <span
                    className={`text-sm font-jb tabular-nums ${
                      bankrupt || wallet < CONSTANTS.TEAM_BUDGET * 0.1
                        ? "text-red-500 dark:text-red-400"
                        : wallet < CONSTANTS.TEAM_BUDGET * 0.3
                          ? "text-amber-500 dark:text-amber-400"
                          : "text-emerald-500 dark:text-emerald-400"
                    }`}
                  >
                    {wallet.toFixed(1)} CHF
                  </span>
                </div>
                <Bar
                  percent={(wallet / CONSTANTS.TEAM_BUDGET) * 100}
                  color={
                    bankrupt || wallet < CONSTANTS.TEAM_BUDGET * 0.1
                      ? "bg-red-500"
                      : wallet < CONSTANTS.TEAM_BUDGET * 0.3
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }
                />
                {!bankrupt && (
                  <div
                    className={`text-[10px] font-jb tabular-nums ${earnRate >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
                  >
                    {earnRate >= 0 ? "+" : ""}
                    {earnRate.toFixed(3)} CHF/s · Infra {metrics.cost.toFixed(0)}{" "}
                    CHF/h
                  </div>
                )}
              </section>

              {/* Vertical scaling */}
              <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp
                    size={13}
                    className="text-zinc-500 dark:text-zinc-400"
                  />
                  <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                    Vertical (per Node)
                  </h2>
                </div>
                <Slider
                  label="CPU Cores"
                  value={cfg.cpuPerNode}
                  min={1}
                  max={16}
                  onChange={(v) => update({ cpuPerNode: v })}
                  unit="cores"
                />
                <Slider
                  label="RAM"
                  value={cfg.ramPerNode}
                  min={1}
                  max={64}
                  onChange={(v) => update({ ramPerNode: v })}
                  unit="GB"
                />
              </section>

              {/* Horizontal scaling */}
              <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Network
                    size={13}
                    className="text-zinc-500 dark:text-zinc-400"
                  />
                  <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                    Horizontal
                  </h2>
                </div>
                <Slider
                  label="Node Count"
                  value={cfg.nodeCount}
                  min={1}
                  max={6}
                  onChange={(v) => update({ nodeCount: v })}
                  unit="nodes"
                />
                <Toggle
                  label="Load Balancer"
                  value={cfg.loadBalancer}
                  onChange={(v) => update({ loadBalancer: v })}
                  hint="Without LB only Node 1 is active."
                />
              </section>

              {/* Sharding */}
              <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Database
                    size={13}
                    className="text-zinc-500 dark:text-zinc-400"
                  />
                  <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                    Sharding
                  </h2>
                </div>
                <Slider
                  label="DB Shards"
                  value={cfg.shards}
                  min={1}
                  max={6}
                  onChange={(v) => update({ shards: v })}
                  unit="shards"
                />
              </section>
            </div>

            {/* Topology + score */}
            <div className="lg:col-span-5 space-y-3">
              <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server
                      size={13}
                      className="text-zinc-500 dark:text-zinc-400"
                    />
                    <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                      Topology
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-jb text-zinc-500">
                    {[
                      ["bg-emerald-500", "ok"],
                      ["bg-amber-500", "warn"],
                      ["bg-red-500", "krit"],
                      ["bg-zinc-400 dark:bg-zinc-600", "idle"],
                    ].map(([c, l]) => (
                      <span key={l} className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 ${c}`} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                <ArchitectureViz cfg={cfg} metrics={metrics} />
              </section>

              {bankrupt ? (
                <section className="border-2 border-red-500 bg-red-500/10 p-5">
                  <div className="text-[10px] uppercase tracking-widest text-red-500 dark:text-red-400 font-jb mb-1">
                    BANKRUPT
                  </div>
                  <div className="text-xl font-jb text-red-600 dark:text-red-300">
                    Infrastructure offline
                  </div>
                  <div className="text-xs text-zinc-500 font-jb mt-2">
                    Final score:{" "}
                    <span className="text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {fmt(score)}
                    </span>
                  </div>
                </section>
              ) : (
                <section
                  className="border-2 p-5"
                  style={{ borderColor: PLAYER_COLOR }}
                >
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                    Coins Mined
                  </div>
                  <div
                    className="text-4xl font-jb tabular-nums"
                    style={{ color: PLAYER_COLOR }}
                  >
                    {fmt(score)}
                  </div>
                  <div className="text-xs text-zinc-500 font-jb mt-1">
                    Throughput:{" "}
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {Math.round(metrics.throughput)}
                    </span>{" "}
                    req/s
                    {metrics.dropped > 1 && (
                      <span className="text-red-500 dark:text-red-400 ml-2">
                        −{Math.round(metrics.dropped)} drops
                      </span>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Utilization + leaderboard */}
            <div className="lg:col-span-3 space-y-3">
              <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                  Utilization
                </h3>
                {[
                  {
                    icon: <Cpu size={11} />,
                    label: "CPU",
                    pct: metrics.cpuPercent,
                    color: "bg-emerald-500",
                  },
                  {
                    icon: <MemoryStick size={11} />,
                    label: "RAM",
                    pct: metrics.ramPercent,
                    color: "bg-cyan-500",
                  },
                  {
                    icon: <Database size={11} />,
                    label: "DB",
                    pct: metrics.dbUtil * 100,
                    color: "bg-violet-500",
                  },
                ].map(({ icon, label, pct, color }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs font-jb">
                      <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                        {icon}
                        {label}
                      </span>
                      <span className="tabular-nums">{pct.toFixed(0)}%</span>
                    </div>
                    <Bar percent={pct} color={color} />
                  </div>
                ))}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-2 text-xs font-jb">
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase tracking-wider">
                      Response
                    </div>
                    <div className="tabular-nums text-zinc-700 dark:text-zinc-200">
                      {Math.round(metrics.responseTime)} ms
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[10px] uppercase tracking-wider">
                      App Cap
                    </div>
                    <div className="tabular-nums text-zinc-700 dark:text-zinc-200">
                      {Math.round(metrics.cpuCapacity)} req/s
                    </div>
                  </div>
                </div>
              </section>

              <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy
                    size={13}
                    className="text-amber-500 dark:text-amber-400"
                  />
                  <h3 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                    Leaderboard
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {allEntries.map((e, i) => (
                    <div
                      key={e.id}
                      className={`flex items-center gap-2 text-xs font-jb ${
                        e.isPlayer
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-zinc-700 dark:text-zinc-300"
                      } ${e.bankrupt ? "opacity-40" : ""}`}
                    >
                      <span className="w-4 text-zinc-500 tabular-nums">
                        #{i + 1}
                      </span>
                      <span
                        className="w-2 h-2 shrink-0"
                        style={{ background: e.color }}
                      />
                      <span className="flex-1 truncate">{e.name}</span>
                      {e.strategy && (
                        <span className="text-[9px] text-zinc-400">
                          {STRATEGY_LABELS[e.strategy]}
                        </span>
                      )}
                      <span className="tabular-nums">{fmt(e.score)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
