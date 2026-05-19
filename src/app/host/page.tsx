"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Pause,
  Play,
  RotateCcw,
  Users,
  Wifi,
  WifiOff,
  ArrowLeft,
  Trash2,
  Lock,
  Zap,
  Timer,
} from "lucide-react";
import { Slider } from "@/components/Slider";
import { supabase, GAME_ID } from "@/lib/supabase";
import { fmt, isStale } from "@/lib/colors";
import { CONSTANTS, computeElapsed } from "@/lib/simulation";
import type { GameRow, TeamRow } from "@/lib/types";
import { DEFAULT_GAME } from "@/lib/defaults";
import { useLang } from "@/lib/lang-context";

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fluctuateLoad(base: number): number {
  const r = Math.random();
  if (r < 0.08) {
    // Spike: 1.8× bis 3×
    return Math.round(Math.min(3000, base * (1.8 + Math.random() * 1.2)));
  } else if (r < 0.15) {
    // Einbruch: 30% bis 60%
    return Math.round(Math.max(50, base * (0.3 + Math.random() * 0.3)));
  } else {
    // Normal: ±25%
    return Math.round(
      Math.max(50, Math.min(3000, base * (0.75 + Math.random() * 0.5))),
    );
  }
}

const HOST_PASSWORD = process.env.NEXT_PUBLIC_HOST_PASSWORD ?? "host";
const SESSION_KEY = "host_authed";

let authListeners: Array<() => void> = [];
function subscribeAuth(cb: () => void) {
  authListeners.push(cb);
  return () => {
    authListeners = authListeners.filter((l) => l !== cb);
  };
}
function getAuthSnapshot() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}
function getAuthServerSnapshot() {
  return false;
}
function setAuthSession(value: boolean) {
  if (value) sessionStorage.setItem(SESSION_KEY, "1");
  else sessionStorage.removeItem(SESSION_KEY);
  authListeners.forEach((l) => l());
}

export default function HostPage() {
  const { t } = useLang();
  const authed = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when lock screen is shown
  useEffect(() => {
    if (!authed) inputRef.current?.focus();
  }, [authed]);

  const submitPassword = () => {
    if (pwInput === HOST_PASSWORD) {
      setAuthSession(true);
    } else {
      setPwError(true);
      setPwInput("");
      setTimeout(() => setPwError(false), 1500);
    }
  };

  const [game, setGame] = useState<GameRow>(DEFAULT_GAME);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [now, setNow] = useState(Date.now());
  const [fluctuate, setFluctuate] = useState(false);
  const gameRef = useRef(game);
  const fluctuateRef = useRef(fluctuate);
  const baseLoadRef = useRef(game.load);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    fluctuateRef.current = fluctuate;
  }, [fluctuate]);

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
      .channel("host-page")
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

  // ─── Timer-Tick + Auto-Stop ───────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      setNow(Date.now());
      const g = gameRef.current;
      if (g.running && g.started_at) {
        const gameDuration =
          g.game_duration ??
          DEFAULT_GAME.game_duration ??
          CONSTANTS.GAME_DURATION;
        const elapsed = computeElapsed(g.started_at, g.running, Date.now());
        if (elapsed >= gameDuration) {
          const encoded = new Date(Math.round(elapsed * 1000)).toISOString();
          await supabase()
            .from("games")
            .update({ running: false, started_at: encoded })
            .eq("id", GAME_ID);
          setGame((prev) => ({ ...prev, running: false, started_at: encoded }));
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Load-Snapshot schreiben (fire-and-forget) ───────────────────────────
  const writeSnapshot = (load: number) => {
    supabase().from("load_snapshots").insert({ game_id: GAME_ID, load }).then();
  };

  // ─── Fluctuate-Interval ───────────────────────────────────────────────────
  useEffect(() => {
    if (!fluctuate || !game.running) return;
    const id = setInterval(() => {
      const newLoad = fluctuateLoad(baseLoadRef.current);
      setGame((prev) => ({ ...prev, load: newLoad }));
      supabase().from("games").update({ load: newLoad }).eq("id", GAME_ID);
      writeSnapshot(newLoad);
    }, 1000);
    return () => clearInterval(id);
  }, [fluctuate, game.running]);

  // ─── Steady-Snapshot: Graph läuft auch ohne Fluctuate weiter ─────────────
  useEffect(() => {
    if (fluctuate || !game.running) return;
    const id = setInterval(() => {
      writeSnapshot(baseLoadRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [fluctuate, game.running]);

  const updateGame = async (patch: Partial<GameRow>) => {
    if ("load" in patch && patch.load !== undefined) {
      baseLoadRef.current = patch.load;
      writeSnapshot(patch.load);
    }
    setGame((prev) => ({ ...prev, ...patch }));
    await supabase().from("games").update(patch).eq("id", GAME_ID);
  };

  const startGame = () => {
    // Fortsetzen vom pausiertem Zeitpunkt
    const elapsed = computeElapsed(game.started_at, game.running, Date.now());
    updateGame({
      running: true,
      started_at: new Date(Date.now() - elapsed * 1000).toISOString(),
    });
  };

  const pauseGame = () => {
    // Elapsed-Sekunden in started_at als 1970-Timestamp kodieren
    const elapsed = computeElapsed(game.started_at, game.running, Date.now());
    updateGame({
      running: false,
      started_at: new Date(Math.round(elapsed * 1000)).toISOString(),
    });
  };

  const handleReset = async () => {
    if (typeof window !== "undefined" && !window.confirm(t.host.confirmReset))
      return;
    const sb = supabase();
    const { error: rpcError } = await sb.rpc("reset_game");
    if (rpcError) {
      await sb.from("teams").delete().eq("game_id", GAME_ID);
      await sb
        .from("games")
        .update({ load: DEFAULT_GAME.load, running: false, started_at: null })
        .eq("id", GAME_ID);
    }
    setGame({ ...DEFAULT_GAME, running: false, started_at: null });
    setTeams([]);
  };

  const deleteTeam = async (id: string, name: string) => {
    if (!window.confirm(t.host.confirmDeleteTeam(name))) return;
    await supabase().from("teams").delete().eq("id", id);
  };

  const sortedTeams = [...teams].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xs">
          <div className="flex items-center gap-2 mb-6">
            <Lock size={16} className="text-amber-500 dark:text-amber-400" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-amber-500 dark:text-amber-400 font-jb">
              Host Console
            </span>
          </div>
          <h1 className="text-xl font-semibold mb-1">{t.host.locked}</h1>
          <p className="text-xs text-zinc-500 font-jb mb-6">
            {t.host.lockedHint}
          </p>
          <input
            ref={inputRef}
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPassword()}
            placeholder={t.host.password}
            className={`w-full bg-zinc-100 dark:bg-zinc-900 border outline-none px-3 py-2.5 text-sm font-jb mb-3 transition-colors ${
              pwError
                ? "border-red-500 text-red-500 dark:text-red-400"
                : "border-zinc-300 dark:border-zinc-700 focus:border-amber-500"
            }`}
          />
          {pwError && (
            <p className="text-xs text-red-500 dark:text-red-400 font-jb mb-3">
              {t.host.wrongPassword}
            </p>
          )}
          <button
            onClick={submitPassword}
            className="w-full bg-amber-500 text-white dark:text-zinc-950 font-medium py-2.5 hover:bg-amber-400 transition-colors font-jb text-sm"
          >
            {t.host.login}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-jb mb-4"
        >
          <ArrowLeft size={12} /> {t.common.back}
        </Link>

        <header className="mb-5 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-amber-500 dark:text-amber-400" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-amber-500 dark:text-amber-400 font-jb">
              Host Console
            </span>
          </div>
          <h1 className="text-2xl font-semibold">{t.host.gameControl}</h1>
          <p className="text-xs text-zinc-500 font-jb mt-1">
            {t.host.connected(teams.length)} ·{" "}
            <span
              className={
                game.running
                  ? "text-emerald-500 dark:text-emerald-400"
                  : "text-zinc-500"
              }
            >
              {game.running ? t.host.running : t.host.paused}
            </span>
          </p>
        </header>

        {/* ─── Spielsteuerung ────────────────────────────────────────── */}
        <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-5 mb-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold">{t.host.gameStatus}</h2>
              {game.started_at &&
                (() => {
                  const gameDuration =
                    game.game_duration ??
                    DEFAULT_GAME.game_duration ??
                    CONSTANTS.GAME_DURATION;
                  const elapsed = computeElapsed(
                    game.started_at,
                    game.running,
                    now,
                  );
                  const tl = gameDuration - elapsed;
                  return (
                    <div
                      className={`flex items-center gap-1.5 text-sm font-jb tabular-nums ${tl < 60 ? "text-red-500 dark:text-red-400" : tl < 120 ? "text-amber-500 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-300"}`}
                    >
                      <Timer size={13} />
                      {formatTime(tl)}
                    </div>
                  );
                })()}
            </div>
            <div className="flex items-center gap-2">
              {game.running ? (
                <button
                  onClick={pauseGame}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/50 hover:bg-amber-500/10 transition-colors text-xs font-jb"
                >
                  <Pause size={12} /> Pause
                </button>
              ) : (
                <button
                  onClick={startGame}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white dark:text-zinc-950 hover:bg-emerald-400 transition-colors text-xs font-jb"
                >
                  <Play size={12} /> {game.started_at ? "Fortsetzen" : "Start"}
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/50 hover:bg-red-500/10 text-red-500 dark:text-red-400 transition-colors text-xs font-jb"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>

          <Slider
            label="Spielzeit"
            value={
              game.game_duration ??
              DEFAULT_GAME.game_duration ??
              CONSTANTS.GAME_DURATION
            }
            min={60}
            max={1200}
            step={60}
            onChange={(v) => updateGame({ game_duration: v })}
            unit="s"
            hint={`${Math.floor((game.game_duration ?? DEFAULT_GAME.game_duration ?? CONSTANTS.GAME_DURATION) / 60)} min`}
            disabled={game.running || !!game.started_at}
          />

          <Slider
            label={t.host.globalLoad}
            value={game.load}
            min={0}
            max={game.max_load ?? DEFAULT_GAME.max_load ?? 3000}
            step={game.load_step ?? DEFAULT_GAME.load_step ?? 50}
            onChange={(v) => updateGame({ load: v })}
            unit="req/s"
            hint={t.host.loadHint}
          />

          <div className="mt-3">
            <button
              onClick={() => {
                if (!fluctuate) baseLoadRef.current = game.load;
                setFluctuate((v) => !v);
              }}
              disabled={!game.running}
              className={`flex items-center gap-1.5 px-3 py-1.5 border transition-colors text-xs font-jb disabled:opacity-40 disabled:cursor-not-allowed ${
                fluctuate
                  ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-amber-500 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <Zap size={12} />
              {fluctuate ? "Fluctuate AN" : "Fluctuate AUS"} — Spikes 1×/s
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-jb">
            <button
              onClick={() => updateGame({ load: 200 })}
              className="border border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 py-2 transition-colors"
            >
              <div className="text-emerald-500 dark:text-emerald-400">
                Phase 1
              </div>
              <div className="text-zinc-500 text-[10px]">200 req/s · easy</div>
            </button>
            <button
              onClick={() => updateGame({ load: 800 })}
              className="border border-zinc-300 dark:border-zinc-700 hover:border-amber-500 py-2 transition-colors"
            >
              <div className="text-amber-500 dark:text-amber-400">Phase 2</div>
              <div className="text-zinc-500 text-[10px]">
                800 req/s · brutal
              </div>
            </button>
            <button
              onClick={() => updateGame({ load: 1800 })}
              className="border border-zinc-300 dark:border-zinc-700 hover:border-red-500 py-2 transition-colors"
            >
              <div className="text-red-500 dark:text-red-400">Phase 3</div>
              <div className="text-zinc-500 text-[10px]">
                1800 req/s · chaos
              </div>
            </button>
          </div>
        </section>

        {/* ─── Teams ────────────────────────────────────────────────── */}
        <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users size={14} /> {t.host.connectedTeams}
          </h2>
          {sortedTeams.length === 0 ? (
            <p className="text-xs text-zinc-500 font-jb">{t.host.noTeams}</p>
          ) : (
            <div className="space-y-1.5">
              {sortedTeams.map((tm, i) => {
                const stale = isStale(tm.last_seen);
                return (
                  <div
                    key={tm.id}
                    className="flex items-center gap-3 text-xs font-jb py-1.5 border-b border-zinc-200/50 dark:border-zinc-800/50"
                  >
                    <span className="w-5 text-zinc-500 tabular-nums">
                      #{i + 1}
                    </span>
                    <span
                      className="w-2.5 h-2.5"
                      style={{ background: tm.color }}
                    />
                    <span className="flex-1 truncate text-zinc-700 dark:text-zinc-200">
                      {tm.name}
                    </span>
                    {stale ? (
                      <WifiOff
                        size={11}
                        className="text-zinc-400 dark:text-zinc-600"
                      />
                    ) : (
                      <Wifi
                        size={11}
                        className="text-emerald-500 dark:text-emerald-400"
                      />
                    )}
                    <span className="tabular-nums w-20 text-right text-zinc-700 dark:text-zinc-300">
                      {fmt(tm.score)}
                    </span>
                    <span className="tabular-nums w-16 text-right text-zinc-500">
                      ${(tm.cost ?? 0).toFixed(0)}/h
                    </span>
                    <span
                      className={`tabular-nums w-16 text-right font-jb ${tm.over_budget ? "text-red-500 dark:text-red-400" : (tm.wallet ?? 100) < 20 ? "text-amber-500 dark:text-amber-400" : "text-zinc-500"}`}
                    >
                      {tm.over_budget
                        ? "BKRPT"
                        : `${(tm.wallet ?? 100).toFixed(0)}c`}
                    </span>
                    <button
                      onClick={() => deleteTeam(tm.id, tm.name)}
                      className="ml-1 text-zinc-400 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title={t.host.deleteTeamTitle}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
