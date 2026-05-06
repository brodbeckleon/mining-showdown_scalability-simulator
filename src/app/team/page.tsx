"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Cpu,
  MemoryStick,
  Database,
  Network,
  TrendingUp,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Server,
} from "lucide-react";
import { Slider } from "@/components/Slider";
import { Toggle } from "@/components/Toggle";
import { Bar } from "@/components/Bar";
import { ArchitectureViz } from "@/components/ArchitectureViz";
import { computeMetrics, CONSTANTS } from "@/lib/simulation";
import { supabase, GAME_ID } from "@/lib/supabase";
import { colorForName, fmt } from "@/lib/colors";
import type { TeamConfig, GameRow, TeamRow } from "@/lib/types";
import { DEFAULT_CFG, DEFAULT_GAME } from "@/lib/defaults";
import { useLang } from "@/lib/lang-context";

const SESSION_TEAM_KEY = "team_session";

export default function TeamPage() {
  const { t } = useLang();
  const [stage, setStage] = useState<"register" | "playing">("register");
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [color, setColor] = useState<string>("#10b981");
  const [cfg, setCfg] = useState<TeamConfig>(DEFAULT_CFG);
  const [game, setGame] = useState<GameRow>(DEFAULT_GAME);
  const [allTeams, setAllTeams] = useState<TeamRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scoreRef = useRef(0);
  const [score, setScore] = useState(0);
  const walletRef = useRef(CONSTANTS.TEAM_BUDGET);
  const [wallet, setWallet] = useState<number>(CONSTANTS.TEAM_BUDGET);
  const lastTickRef = useRef<number | null>(null);
  const cfgRef = useRef(cfg);
  const teamIdRef = useRef<string | null>(null);

  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);
  useEffect(() => {
    teamIdRef.current = teamId;
  }, [teamId]);

  // ─── Session wiederherstellen nach Reload ─────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_TEAM_KEY);
    if (!stored) return;
    let parsed: { teamId: string; teamName: string; color: string };
    try {
      parsed = JSON.parse(stored);
    } catch {
      sessionStorage.removeItem(SESSION_TEAM_KEY);
      return;
    }
    supabase()
      .from("teams")
      .select("*")
      .eq("id", parsed.teamId)
      .single()
      .then(({ data }) => {
        if (!data) {
          sessionStorage.removeItem(SESSION_TEAM_KEY);
          return;
        }
        setTeamId(parsed.teamId);
        setTeamName(parsed.teamName);
        setColor(parsed.color);
        setCfg(data.cfg ?? DEFAULT_CFG);
        scoreRef.current = data.score ?? 0;
        setScore(data.score ?? 0);
        walletRef.current = data.wallet ?? CONSTANTS.TEAM_BUDGET;
        setWallet(data.wallet ?? CONSTANTS.TEAM_BUDGET);
        lastTickRef.current = Date.now();
        setStage("playing");
      });
  }, []);

  const metrics = useMemo(
    () => computeMetrics(cfg, game.load),
    [cfg, game.load],
  );
  const bankrupt = wallet <= 0;
  const deployed = !bankrupt && game.running;
  const earnRate =
    metrics.throughput * CONSTANTS.EARN_RATE -
    metrics.cost * CONSTANTS.SPEND_RATE;

  // ─── Registrierung ────────────────────────────────────────────────────────
  const register = useCallback(async () => {
    const trimmed = teamName.trim();
    if (!trimmed) return;
    const teamColor = colorForName(trimmed);

    try {
      const { data, error: insertError } = await supabase()
        .from("teams")
        .insert({
          game_id: GAME_ID,
          name: trimmed,
          color: teamColor,
          cfg: DEFAULT_CFG,
          score: 0,
          last_seen: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? t.team.errorCreate);
        return;
      }

      setTeamId(data.id);
      setColor(teamColor);
      scoreRef.current = 0;
      setScore(0);
      walletRef.current = CONSTANTS.TEAM_BUDGET;
      setWallet(CONSTANTS.TEAM_BUDGET);
      lastTickRef.current = Date.now();
      sessionStorage.setItem(
        SESSION_TEAM_KEY,
        JSON.stringify({
          teamId: data.id,
          teamName: trimmed,
          color: teamColor,
        }),
      );
      setStage("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.team.errorFallback);
    }
  }, [teamName, t]);

  // ─── Spielzustand laden + abonnieren ──────────────────────────────────────
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
      if (mounted && ts) setAllTeams(ts as TeamRow[]);
    };
    loadInitial();

    const channel = sb
      .channel("team-page")
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
              if (mounted && data) setAllTeams(data as TeamRow[]);
            });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      sb.removeChannel(channel);
    };
  }, []);

  // ─── Score akkumulieren + an Supabase pushen ──────────────────────────────
  useEffect(() => {
    if (stage !== "playing" || !teamId) return;
    if (lastTickRef.current === null) {
      lastTickRef.current = Date.now();
    }

    const interval = setInterval(async () => {
      const now = Date.now();
      const dt = (now - (lastTickRef.current ?? now)) / 1000;
      lastTickRef.current = now;

      const liveMetrics = computeMetrics(cfgRef.current, game.load);
      const liveBankrupt = walletRef.current <= 0;
      const liveDeployed = !liveBankrupt && game.running;

      if (liveDeployed && dt > 0 && dt < 10) {
        scoreRef.current += liveMetrics.throughput * dt;
        setScore(scoreRef.current);
        const netPerSec =
          liveMetrics.throughput * CONSTANTS.EARN_RATE -
          liveMetrics.cost * CONSTANTS.SPEND_RATE;
        walletRef.current += netPerSec * dt;
        setWallet(walletRef.current);
      }

      await supabase()
        .from("teams")
        .update({
          cfg: cfgRef.current,
          score: scoreRef.current,
          wallet: Math.max(0, walletRef.current),
          cost: liveMetrics.cost,
          throughput: liveMetrics.throughput,
          dropped: liveMetrics.dropped,
          response_time: liveMetrics.responseTime,
          cpu_percent: liveMetrics.cpuPercent,
          ram_percent: liveMetrics.ramPercent,
          deployed: liveDeployed,
          over_budget: liveBankrupt,
          last_seen: new Date().toISOString(),
        })
        .eq("id", teamId);
    }, 1500);

    return () => clearInterval(interval);
  }, [stage, teamId, game.load, game.running]);

  // ─── Registrierungs-Stage ─────────────────────────────────────────────────
  if (stage === "register") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 font-jb mb-6"
          >
            <ArrowLeft size={12} /> {t.common.back}
          </Link>
          <h1 className="text-2xl font-semibold mb-1">{t.team.joinTitle}</h1>
          <p className="text-sm text-zinc-500 mb-8 font-jb">
            {t.team.joinSubtitle}
          </p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="team-name"
                className="text-[11px] uppercase tracking-wider text-zinc-400 font-jb"
              >
                {t.team.teamName}
              </label>
              <input
                id="team-name"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && register()}
                placeholder={t.team.namePlaceholder}
                maxLength={24}
                autoFocus
                className="w-full mt-1.5 bg-zinc-900 border border-zinc-700 focus:border-emerald-500 outline-none px-3 py-2.5 text-sm font-jb"
              />
              {teamName.trim() && (
                <div className="mt-2 flex items-center gap-2 text-xs font-jb">
                  <div
                    className="w-3 h-3"
                    style={{ background: colorForName(teamName.trim()) }}
                  />
                  <span className="text-zinc-500">{t.team.colorHint}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 font-jb">
                {error}
              </div>
            )}

            <button
              onClick={register}
              disabled={!teamName.trim()}
              className="w-full bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-medium py-2.5 hover:bg-emerald-400 transition-colors font-jb text-sm"
            >
              {t.team.joinButton}
            </button>

            <div className="border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-400 font-jb leading-relaxed">
              <span className="text-emerald-400">Wallet:</span>{" "}
              {t.team.walletHint(CONSTANTS.TEAM_BUDGET)}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── Playing-Stage ────────────────────────────────────────────────────────
  const update = (patch: Partial<TeamConfig>) =>
    setCfg((prev) => ({ ...prev, ...patch }));
  const sortedTeams = [...allTeams].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );
  const myRank = sortedTeams.findIndex((tm) => tm.id === teamId) + 1;

  // suppress unused warning
  void deployed;

  const statusClass = bankrupt
    ? "border-red-500/40 bg-red-500/10 text-red-400"
    : !game.running
      ? "border-zinc-700 bg-zinc-900/30 text-zinc-400"
      : earnRate < 0
        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
        : metrics.dropped > 1
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";

  const statusText = bankrupt
    ? t.team.statusBankrupt
    : !game.running
      ? t.team.statusNotStarted
      : earnRate < 0
        ? t.team.statusDraining(earnRate.toFixed(3))
        : metrics.dropped > 1
          ? t.team.statusBottleneck(Math.round(metrics.dropped))
          : t.team.statusOk;

  return (
    <main className="min-h-screen p-3 md:p-5">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3" style={{ background: color }} />
            <div>
              <div className="text-sm font-semibold">{teamName}</div>
              <div className="text-[10px] text-zinc-500 font-jb">
                {game.running ? (
                  <span className="text-emerald-400">● live</span>
                ) : (
                  <span className="text-zinc-600">○ {t.team.waitingHost}</span>
                )}{" "}
                · {t.team.load}: {game.load} req/s
              </div>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300 font-jb"
            onClick={() => {
              sessionStorage.removeItem(SESSION_TEAM_KEY);
              const id = teamIdRef.current;
              if (id) supabase().from("teams").delete().eq("id", id);
            }}
          >
            {t.common.leave}
          </Link>
        </header>

        {/* Status */}
        <div
          className={`mb-4 border px-3 py-2 flex items-center gap-2 text-xs font-jb ${statusClass}`}
        >
          {bankrupt ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
          <span className="flex-1">{statusText}</span>
          {myRank > 0 && (
            <span className="text-zinc-500">
              {t.team.rank} #{myRank}/{allTeams.length}
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-12 gap-4">
          {/* ─── Linke Spalte: Konfiguration ─────────────────────────── */}
          <div className="lg:col-span-4 space-y-3">
            <section className="border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign size={13} className="text-emerald-400" />
                  <h2 className="text-[11px] uppercase tracking-widest text-zinc-400 font-jb">
                    Wallet
                  </h2>
                </div>
                <span
                  className={`text-sm font-jb tabular-nums ${
                    bankrupt || wallet < 20
                      ? "text-red-400"
                      : wallet < 50
                        ? "text-amber-400"
                        : wallet > 100
                          ? "text-yellow-300"
                          : "text-emerald-400"
                  }`}
                >
                  {wallet.toFixed(1)} coins
                </span>
              </div>
              <Bar
                percent={Math.min(100, wallet)}
                color={
                  bankrupt || wallet < 20
                    ? "bg-red-500"
                    : wallet < 50
                      ? "bg-amber-500"
                      : wallet > 100
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                }
                criticalAt={101}
                goldOverflow={wallet > 100}
              />
              {game.running && !bankrupt && (
                <div
                  className={`text-[10px] font-jb tabular-nums ${earnRate >= 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {earnRate >= 0 ? "+" : ""}
                  {earnRate.toFixed(3)}/s · Infra ${metrics.cost.toFixed(0)}/h
                </div>
              )}
            </section>

            <section className="border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-zinc-400" />
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-400 font-jb">
                  {t.team.verticalSection}
                </h2>
              </div>
              <Slider
                label={t.team.cpuCores}
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
                max={32}
                onChange={(v) => update({ ramPerNode: v })}
                unit="GB"
              />
            </section>

            <section className="border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Network size={13} className="text-zinc-400" />
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-400 font-jb">
                  {t.team.horizontal}
                </h2>
              </div>
              <Slider
                label={t.team.nodeCount}
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
                hint={t.team.lbHint}
              />
            </section>

            <section className="border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Database size={13} className="text-zinc-400" />
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-400 font-jb">
                  {t.team.sharding}
                </h2>
              </div>
              <Slider
                label={t.team.dbShards}
                value={cfg.shards}
                min={1}
                max={6}
                onChange={(v) => update({ shards: v })}
                unit="shards"
              />
            </section>
          </div>

          {/* ─── Mitte: Topologie + Score ────────────────────────────── */}
          <div className="lg:col-span-5 space-y-3">
            <section className="border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Server size={13} className="text-zinc-400" />
                  <h2 className="text-[11px] uppercase tracking-widest text-zinc-400 font-jb">
                    {t.team.topology}
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-[9px] font-jb text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500" />
                    ok
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-500" />
                    warn
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500" />
                    krit
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-zinc-600" />
                    idle
                  </span>
                </div>
              </div>
              <ArchitectureViz cfg={cfg} metrics={metrics} />
            </section>

            {bankrupt ? (
              <section className="border-2 border-red-500 bg-red-500/10 p-5">
                <div className="text-[10px] uppercase tracking-widest text-red-400 font-jb mb-1">
                  BANKRUPT
                </div>
                <div className="text-xl font-jb text-red-300">
                  {t.team.infraOffline}
                </div>
                <div className="text-xs text-zinc-500 font-jb mt-2">
                  {t.team.finalScore}:{" "}
                  <span className="text-zinc-300 tabular-nums">
                    {fmt(score)}
                  </span>
                </div>
              </section>
            ) : (
              <section className="border-2 p-5" style={{ borderColor: color }}>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                  Score
                </div>
                <div
                  className="text-4xl font-jb tabular-nums"
                  style={{ color }}
                >
                  {fmt(score)}
                </div>
                <div className="text-xs text-zinc-500 font-jb mt-1">
                  {t.team.throughput}:{" "}
                  <span className="text-zinc-300">
                    {Math.round(metrics.throughput)}
                  </span>{" "}
                  req/s
                  {metrics.dropped > 1 && (
                    <span className="text-red-400 ml-2">
                      −{Math.round(metrics.dropped)} drops
                    </span>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* ─── Rechte Spalte: Auslastung + Mini-Leaderboard ────────── */}
          <div className="lg:col-span-3 space-y-3">
            <section className="border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-jb">
                {t.team.utilization}
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-jb">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Cpu size={11} />
                    CPU
                  </span>
                  <span className="tabular-nums">
                    {metrics.cpuPercent.toFixed(0)}%
                  </span>
                </div>
                <Bar percent={metrics.cpuPercent} color="bg-emerald-500" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-jb">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <MemoryStick size={11} />
                    RAM
                  </span>
                  <span className="tabular-nums">
                    {metrics.ramPercent.toFixed(0)}%
                  </span>
                </div>
                <Bar percent={metrics.ramPercent} color="bg-cyan-500" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-jb">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Database size={11} />
                    DB
                  </span>
                  <span className="tabular-nums">
                    {(metrics.dbUtil * 100).toFixed(0)}%
                  </span>
                </div>
                <Bar percent={metrics.dbUtil * 100} color="bg-violet-500" />
              </div>
              <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-2 text-xs font-jb">
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-wider">
                    {t.team.responseTime}
                  </div>
                  <div className="tabular-nums text-zinc-200">
                    {Math.round(metrics.responseTime)} ms
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-wider">
                    {t.team.appCap}
                  </div>
                  <div className="tabular-nums text-zinc-200">
                    {Math.round(metrics.cpuCapacity)} req/s
                  </div>
                </div>
              </div>
            </section>

            <section className="border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={13} className="text-amber-400" />
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-jb">
                  Top 5
                </h3>
              </div>
              <div className="space-y-1.5">
                {sortedTeams.slice(0, 5).map((tm, i) => (
                  <div
                    key={tm.id}
                    className={`flex items-center gap-2 text-xs font-jb ${
                      tm.id === teamId ? "text-emerald-400" : "text-zinc-300"
                    }`}
                  >
                    <span className="w-4 text-zinc-500 tabular-nums">
                      #{i + 1}
                    </span>
                    <span
                      className="w-2 h-2"
                      style={{ background: tm.color }}
                    />
                    <span className="flex-1 truncate">{tm.name}</span>
                    <span className="tabular-nums">{fmt(tm.score)}</span>
                  </div>
                ))}
                {sortedTeams.length === 0 && (
                  <div className="text-[11px] text-zinc-600 font-jb">
                    {t.team.noTeamsYet}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
