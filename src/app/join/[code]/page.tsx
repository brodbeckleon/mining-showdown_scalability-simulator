"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Cpu,
  MemoryStick,
  Database,
  Network,
  TrendingUp,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Server,
  Coins,
} from "lucide-react";
import { Slider } from "@/components/Slider";
import { Toggle } from "@/components/Toggle";
import { Bar } from "@/components/Bar";
import { ArchitectureViz } from "@/components/ArchitectureViz";
import { computeMetrics, CONSTANTS, computeElapsed } from "@/lib/simulation";
import { supabase } from "@/lib/supabase";
import { colorForName, fmt } from "@/lib/colors";
import type { TeamConfig, GameRow, TeamRow, LoadSnapshot } from "@/lib/types";
import { DEFAULT_CFG } from "@/lib/defaults";
import { useLang } from "@/lib/lang-context";

const DEFAULT_SESSION_GAME: GameRow = {
  id: "",
  load: 0,
  running: false,
  started_at: null,
  created_at: new Date().toISOString(),
  load_step: 50,
  max_load: 3000,
  game_duration: 360,
};

export default function JoinPage() {
  const { t } = useLang();
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const sessionKey = `team_session_${code}`;

  // Session resolution
  const [gameId, setGameId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Team
  const [stage, setStage] = useState<"register" | "playing">("register");
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [color, setColor] = useState<string>("#10b981");
  const [cfg, setCfg] = useState<TeamConfig>(DEFAULT_CFG);
  const [game, setGame] = useState<GameRow>(DEFAULT_SESSION_GAME);
  const [allTeams, setAllTeams] = useState<TeamRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const scoreRef = useRef(0);
  const [score, setScore] = useState(0);
  const walletRef = useRef(CONSTANTS.TEAM_BUDGET);
  const [wallet, setWallet] = useState<number>(CONSTANTS.TEAM_BUDGET);
  const lastTickRef = useRef<number | null>(null);
  const cfgRef = useRef(cfg);
  const gameRef = useRef<GameRow>(DEFAULT_SESSION_GAME);
  const teamIdRef = useRef<string | null>(null);
  const gameIdRef = useRef<string | null>(null);

  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);
  useEffect(() => {
    teamIdRef.current = teamId;
  }, [teamId]);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Resolve code → gameId ─────────────────────────────────────────────
  useEffect(() => {
    supabase()
      .from("games")
      .select("*")
      .eq("code", code)
      .single()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
          setResolving(false);
          return;
        }
        const g = data as GameRow;
        setGameId(g.id);
        gameIdRef.current = g.id;
        setGame(g);
        gameRef.current = g;
        setResolving(false);

        // Restore session after reload
        const stored = sessionStorage.getItem(sessionKey);
        if (!stored) return;
        let parsed: { teamId: string; teamName: string; color: string };
        try {
          parsed = JSON.parse(stored);
        } catch {
          sessionStorage.removeItem(sessionKey);
          return;
        }
        supabase()
          .from("teams")
          .select("*")
          .eq("id", parsed.teamId)
          .single()
          .then(({ data: tm }) => {
            if (!tm) {
              sessionStorage.removeItem(sessionKey);
              return;
            }
            setTeamId(parsed.teamId);
            setTeamName(parsed.teamName);
            setColor(parsed.color);
            setCfg(tm.cfg ?? DEFAULT_CFG);
            scoreRef.current = tm.score ?? 0;
            setScore(tm.score ?? 0);
            walletRef.current = tm.wallet ?? CONSTANTS.TEAM_BUDGET;
            setWallet(tm.wallet ?? CONSTANTS.TEAM_BUDGET);
            lastTickRef.current = Date.now();
            setStage("playing");
          });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ─── Realtime subscriptions ────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;
    let mounted = true;
    const sb = supabase();

    sb.from("teams")
      .select("*")
      .eq("game_id", gameId)
      .then(({ data }) => {
        if (mounted && data) setAllTeams(data as TeamRow[]);
      });

    const channel = sb
      .channel(`join-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
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
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          if (!mounted || !payload.new) return;
          const snap = payload.new as LoadSnapshot;
          gameRef.current = { ...gameRef.current, load: snap.load };
          setGame((prev) => ({ ...prev, load: snap.load }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          sb.from("teams")
            .select("*")
            .eq("game_id", gameId)
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
  }, [gameId]);

  // ─── Register ─────────────────────────────────────────────────────────
  const register = useCallback(async () => {
    if (!gameId) return;
    const trimmed = teamName.trim();
    if (!trimmed) return;
    const teamColor = colorForName(trimmed);
    try {
      const { data, error: insertError } = await supabase()
        .from("teams")
        .insert({
          game_id: gameId,
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
        sessionKey,
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
  }, [gameId, teamName, sessionKey, t]);

  // ─── Score tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "playing" || !teamId) return;
    if (lastTickRef.current === null) lastTickRef.current = Date.now();

    const interval = setInterval(async () => {
      const tickNow = Date.now();
      const dt = (tickNow - (lastTickRef.current ?? tickNow)) / 1000;
      lastTickRef.current = tickNow;

      const g = gameRef.current;
      const liveMetrics = computeMetrics(cfgRef.current, g.load);
      const liveBankrupt = walletRef.current <= 0;
      const liveDeployed = !liveBankrupt && g.running;

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
  }, [stage, teamId]);

  // ─── Derived ──────────────────────────────────────────────────────────
  const metrics = useMemo(
    () => computeMetrics(cfg, game.load),
    [cfg, game.load],
  );
  const bankrupt = wallet <= 0;
  const earnRate =
    metrics.throughput * CONSTANTS.EARN_RATE -
    metrics.cost * CONSTANTS.SPEND_RATE;
  const sortedTeams = [...allTeams].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );
  const myRank = sortedTeams.findIndex((tm) => tm.id === teamId) + 1;
  const gameDuration = game.game_duration ?? 360;
  const timeLeft = game.started_at
    ? gameDuration - computeElapsed(game.started_at, game.running, now)
    : null;
  const gameOver = timeLeft !== null && timeLeft <= 0;

  const statusClass = bankrupt
    ? "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400"
    : !game.running
      ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-900/30 text-zinc-500 dark:text-zinc-400"
      : earnRate < 0
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : metrics.dropped > 1
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

  const statusText = bankrupt
    ? t.team.statusBankrupt
    : !game.running && !game.started_at
      ? t.team.statusNotStarted
      : !game.running
        ? t.team.statusPaused
        : earnRate < 0
          ? t.team.statusDraining(earnRate.toFixed(3))
          : metrics.dropped > 1
            ? t.team.statusBottleneck(Math.round(metrics.dropped))
            : t.team.statusOk;

  const update = (patch: Partial<TeamConfig>) =>
    setCfg((prev) => ({ ...prev, ...patch }));

  // ─── Loading / not found ───────────────────────────────────────────────
  if (resolving) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400 dark:text-zinc-600 font-jb text-sm animate-pulse">
          {t.session.joining}
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl font-bold font-jb text-zinc-300 dark:text-zinc-700 mb-3">
            {code}
          </div>
          <div className="text-sm text-zinc-500 font-jb mb-6">
            {t.session.joinNotFound}
          </div>
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-jb underline"
          >
            {t.session.backToHome}
          </Link>
        </div>
      </main>
    );
  }

  // ─── Register stage ────────────────────────────────────────────────────
  if (stage === "register") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-jb mb-6"
          >
            <ArrowLeft size={12} /> {t.common.back}
          </Link>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-amber-500 dark:text-amber-400 font-jb">
              Session
            </span>
            <span className="text-sm font-bold font-jb tracking-widest text-zinc-900 dark:text-zinc-100">
              {code}
            </span>
          </div>
          <h1 className="text-2xl font-semibold mb-1">{t.team.joinTitle}</h1>
          <p className="text-sm text-zinc-500 mb-8 font-jb">
            {t.team.joinSubtitle}
          </p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="team-name"
                className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-jb"
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
                className="w-full mt-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 outline-none px-3 py-2.5 text-sm font-jb"
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
              <div className="border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-400 font-jb">
                {error}
              </div>
            )}

            <button
              onClick={register}
              disabled={!teamName.trim()}
              className="w-full bg-emerald-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 text-white dark:text-zinc-950 font-medium py-2.5 hover:bg-emerald-400 transition-colors font-jb text-sm"
            >
              {t.team.joinButton}
            </button>

            <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-3 text-xs text-zinc-500 dark:text-zinc-400 font-jb leading-relaxed">
              <span className="text-emerald-500 dark:text-emerald-400">
                Wallet:
              </span>{" "}
              {t.team.walletHint(CONSTANTS.TEAM_BUDGET)}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── Playing stage ─────────────────────────────────────────────────────
  return (
    <main className="min-h-screen p-3 md:p-5">
      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 dark:bg-zinc-950/80 backdrop-blur-sm p-6">
          <div
            className="w-full max-w-sm border-2 bg-white dark:bg-zinc-950 p-8 text-center"
            style={{ borderColor: color }}
          >
            <Trophy size={40} className="mx-auto mb-4 text-amber-400" />
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
              {t.team.gameOverTitle}
            </div>
            <div className="text-sm font-semibold mb-5">{teamName}</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
              {t.team.finalPlacement}
            </div>
            <div
              className="text-6xl font-jb tabular-nums mb-1"
              style={{ color }}
            >
              #{myRank > 0 ? myRank : "—"}
            </div>
            <div className="text-xs text-zinc-500 font-jb mb-6">
              {t.team.of} {allTeams.length} {t.team.participants}
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                {t.team.finalScore}
              </div>
              <div className="text-2xl font-jb tabular-nums" style={{ color }}>
                {fmt(score)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3" style={{ background: color }} />
            <div>
              <div className="text-sm font-semibold">{teamName}</div>
              <div className="text-[10px] text-zinc-500 font-jb">
                {game.running ? (
                  <span className="text-emerald-500 dark:text-emerald-400">
                    ● live
                  </span>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-600">
                    ○ {t.team.waitingHost}
                  </span>
                )}{" "}
                · {t.team.load}: {game.load} req/s ·{" "}
                <span className="text-amber-500 dark:text-amber-400">
                  {code}
                </span>
              </div>
            </div>
          </div>
          {timeLeft !== null &&
            (() => {
              const tl = timeLeft;
              const m = Math.floor(Math.max(0, tl) / 60);
              const s = Math.floor(Math.max(0, tl) % 60);
              return (
                <div
                  className={`text-sm font-jb tabular-nums ${tl <= 0 ? "text-zinc-400 dark:text-zinc-600" : tl < 60 ? "text-red-500 dark:text-red-400" : tl < 120 ? "text-amber-500 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {tl <= 0 ? "0:00" : `${m}:${s.toString().padStart(2, "0")}`}
                </div>
              );
            })()}
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-jb"
            onClick={() => {
              sessionStorage.removeItem(sessionKey);
              const id = teamIdRef.current;
              if (id) supabase().from("teams").delete().eq("id", id);
            }}
          >
            {t.common.leave}
          </Link>
        </header>

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
          {/* Config */}
          <div
            className={`lg:col-span-4 space-y-3 ${gameOver ? "pointer-events-none opacity-40" : ""}`}
          >
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
                  className={`text-sm font-jb tabular-nums ${bankrupt || wallet < CONSTANTS.TEAM_BUDGET * 0.1 ? "text-red-500 dark:text-red-400" : wallet < CONSTANTS.TEAM_BUDGET * 0.3 ? "text-amber-500 dark:text-amber-400" : "text-emerald-500 dark:text-emerald-400"}`}
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
              {game.running && !bankrupt && (
                <div
                  className={`text-[10px] font-jb tabular-nums ${earnRate >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
                >
                  {earnRate >= 0 ? "+" : ""}
                  {earnRate.toFixed(3)} CHF/s · Infra {metrics.cost.toFixed(0)}{" "}
                  CHF/h
                </div>
              )}
            </section>

            <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp
                  size={13}
                  className="text-zinc-500 dark:text-zinc-400"
                />
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
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
                max={64}
                onChange={(v) => update({ ramPerNode: v })}
                unit="GB"
              />
            </section>

            <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Network
                  size={13}
                  className="text-zinc-500 dark:text-zinc-400"
                />
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
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

            <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Database
                  size={13}
                  className="text-zinc-500 dark:text-zinc-400"
                />
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
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

          {/* Topology + Score */}
          <div className="lg:col-span-5 space-y-3">
            <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Server
                    size={13}
                    className="text-zinc-500 dark:text-zinc-400"
                  />
                  <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                    {t.team.topology}
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
                  {t.team.infraOffline}
                </div>
                <div className="text-xs text-zinc-500 font-jb mt-2">
                  {t.team.finalScore}:{" "}
                  <span className="text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {fmt(score)}
                  </span>
                </div>
              </section>
            ) : (
              <section className="border-2 p-5" style={{ borderColor: color }}>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                  {t.team.coinsMined}
                </div>
                <div
                  className="text-4xl font-jb tabular-nums"
                  style={{ color }}
                >
                  {fmt(score)}
                </div>
                <div className="text-xs text-zinc-500 font-jb mt-1">
                  {t.team.throughput}:{" "}
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

          {/* Utilization + Leaderboard */}
          <div className="lg:col-span-3 space-y-3">
            <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 space-y-3">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-jb">
                {t.team.utilization}
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
                    {t.team.responseTime}
                  </div>
                  <div className="tabular-nums text-zinc-700 dark:text-zinc-200">
                    {Math.round(metrics.responseTime)} ms
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-wider">
                    {t.team.appCap}
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
                  Top 5
                </h3>
              </div>
              <div className="space-y-1.5">
                {sortedTeams.slice(0, 5).map((tm, i) => (
                  <div
                    key={tm.id}
                    className={`flex items-center gap-2 text-xs font-jb ${tm.id === teamId ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}
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
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-600 font-jb">
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
