"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Pause,
  Play,
  RotateCcw,
  Users,
  Wifi,
  WifiOff,
  Trash2,
  Zap,
  Timer,
  Share2,
  Copy,
  Check,
  Crown,
  Eye,
  EyeOff,
  BookOpen,
  X,
  Trophy,
} from "lucide-react";
import { Slider } from "@/components/Slider";
import { StrategyPanel } from "@/components/StrategyPanel";
import { BackButton } from "@/components/BackButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { supabase } from "@/lib/supabase";
import { fmt, isStale } from "@/lib/colors";
import { CONSTANTS, computeElapsed } from "@/lib/simulation";
import { classifyStrategy, STRATEGIES } from "@/lib/strategies";
import type { GameRow, TeamRow, LoadSnapshot } from "@/lib/types";
import { useLang } from "@/lib/lang-context";

const GRAPH_POINTS = 120;

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

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fluctuateLoad(base: number): number {
  const r = Math.random();
  if (r < 0.08)
    return Math.round(Math.min(3000, base * (1.8 + Math.random() * 1.2)));
  if (r < 0.15)
    return Math.round(Math.max(50, base * (0.3 + Math.random() * 0.3)));
  return Math.round(
    Math.max(50, Math.min(3000, base * (0.75 + Math.random() * 0.5))),
  );
}

// ─── Share Modal ────────────────────────────────────────────────────────────
function ShareModal({ code, onClose }: { code: string; onClose: () => void }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const joinUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${code}`
        : `/join/${code}`,
    [code],
  );

  const copy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="text-[11px] uppercase tracking-[0.3em] text-amber-500 dark:text-amber-400 font-jb mb-1">
          {t.session.shareTitle}
        </div>
        <div className="text-xs text-zinc-500 font-jb mb-6">
          {t.session.shareSubtitle}
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6 p-4 bg-white">
          <QRCodeSVG
            value={joinUrl}
            size={220}
            bgColor="#ffffff"
            fgColor="#09090b"
            level="M"
          />
        </div>

        {/* Session code */}
        <div className="text-center mb-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
            {t.session.sessionCode}
          </div>
          <div className="text-4xl font-bold font-jb tracking-widest text-zinc-900 dark:text-zinc-100">
            {code}
          </div>
        </div>

        {/* URL */}
        <div
          className="border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-xs font-jb text-zinc-600 dark:text-zinc-400 mb-4 break-all cursor-pointer hover:border-amber-500 transition-colors"
          onClick={copy}
          title={t.session.clickToCopy}
        >
          {joinUrl}
        </div>

        <button
          onClick={copy}
          className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-jb transition-colors border ${
            copied
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-zinc-300 dark:border-zinc-700 hover:border-amber-500 text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t.session.copied : t.session.copyLink}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SessionPage() {
  const { t } = useLang();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  // Resolved game
  const [gameId, setGameId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // UI
  const [showShareModal, setShowShareModal] = useState(false);
  const [showStrategies, setShowStrategies] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<null | {
    message: string;
    danger?: boolean;
    onConfirm: () => void;
  }>(null);

  // Game state
  const [game, setGame] = useState<GameRow>(DEFAULT_SESSION_GAME);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [fluctuate, setFluctuate] = useState(false);
  const [loadHistory, setLoadHistory] = useState<number[]>([]);

  // Refs to avoid stale closures
  const gameRef = useRef<GameRow>(DEFAULT_SESSION_GAME);
  const fluctuateRef = useRef(false);
  const baseLoadRef = useRef(0);
  const gameIdRef = useRef<string | null>(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    fluctuateRef.current = fluctuate;
  }, [fluctuate]);

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
          setLoading(false);
          return;
        }
        const g = data as GameRow;
        setGameId(g.id);
        gameIdRef.current = g.id;
        setGame(g);
        gameRef.current = g;
        baseLoadRef.current = g.load;

        const owned =
          typeof window !== "undefined" &&
          sessionStorage.getItem(`session_owner_${code}`) === g.id;
        setIsOwner(owned);
        setLoading(false);
      });
  }, [code]);

  // ─── Timer tick ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Realtime subscriptions (runs once gameId is known) ────────────────
  useEffect(() => {
    if (!gameId) return;
    let mounted = true;
    const sb = supabase();

    // Load initial teams + snapshots
    sb.from("teams")
      .select("*")
      .eq("game_id", gameId)
      .then(({ data }) => {
        if (mounted && data) setTeams(data as TeamRow[]);
      });
    sb.from("load_snapshots")
      .select("load")
      .eq("game_id", gameId)
      .order("recorded_at", { ascending: false })
      .limit(GRAPH_POINTS)
      .then(({ data: snaps }) => {
        if (mounted && snaps && snaps.length > 0) {
          setLoadHistory(snaps.map((s) => s.load).reverse());
        }
      });

    const channel = sb
      .channel(`session-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (!mounted || !payload.new) return;
          const g = payload.new as GameRow;
          gameRef.current = g;
          setGame(g);
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
          filter: `game_id=eq.${gameId}`,
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
          filter: `game_id=eq.${gameId}`,
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
          filter: `game_id=eq.${gameId}`,
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
  }, [gameId]);

  // ─── Auto-stop when duration elapsed ─────────────────────────────────
  useEffect(() => {
    if (!gameId) return;
    const id = setInterval(async () => {
      setNow(Date.now());
      const g = gameRef.current;
      if (g.running && g.started_at) {
        const duration = g.game_duration ?? 360;
        const elapsed = computeElapsed(g.started_at, g.running, Date.now());
        if (elapsed >= duration) {
          const encoded = new Date(Math.round(elapsed * 1000)).toISOString();
          await supabase()
            .from("games")
            .update({ running: false, started_at: encoded })
            .eq("id", gameId);
          setGame((prev) => ({ ...prev, running: false, started_at: encoded }));
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [gameId]);

  // ─── Load snapshot (steady) ───────────────────────────────────────────
  const writeSnapshot = useCallback(
    (load: number) => {
      if (!gameId) return;
      supabase()
        .from("load_snapshots")
        .insert({ game_id: gameId, load })
        .then();
    },
    [gameId],
  );

  // ─── Fluctuate interval ───────────────────────────────────────────────
  useEffect(() => {
    if (!fluctuate || !game.running || !gameId) return;
    const id = setInterval(() => {
      const newLoad = fluctuateLoad(baseLoadRef.current);
      setGame((prev) => ({ ...prev, load: newLoad }));
      supabase().from("games").update({ load: newLoad }).eq("id", gameId!);
      writeSnapshot(newLoad);
    }, 1000);
    return () => clearInterval(id);
  }, [fluctuate, game.running, gameId, writeSnapshot]);

  // ─── Steady snapshot (no fluctuate) ──────────────────────────────────
  useEffect(() => {
    if (fluctuate || !game.running || !gameId) return;
    const id = setInterval(() => writeSnapshot(baseLoadRef.current), 1000);
    return () => clearInterval(id);
  }, [fluctuate, game.running, gameId, writeSnapshot]);

  // ─── Keyboard shortcut: S toggles strategies ─────────────────────────
  const onKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "s" || e.key === "S") setShowStrategies((v) => !v);
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // ─── Game actions ─────────────────────────────────────────────────────
  const updateGame = async (patch: Partial<GameRow>) => {
    if (!gameId) return;
    if ("load" in patch && patch.load !== undefined) {
      baseLoadRef.current = patch.load;
      writeSnapshot(patch.load);
    }
    setGame((prev) => ({ ...prev, ...patch }));
    await supabase().from("games").update(patch).eq("id", gameId);
  };

  const startGame = () => {
    const elapsed = computeElapsed(game.started_at, game.running, Date.now());
    updateGame({
      running: true,
      started_at: new Date(Date.now() - elapsed * 1000).toISOString(),
    });
  };

  const pauseGame = () => {
    const elapsed = computeElapsed(game.started_at, game.running, Date.now());
    updateGame({
      running: false,
      started_at: new Date(Math.round(elapsed * 1000)).toISOString(),
    });
  };

  const handleReset = () => {
    if (!gameId) return;
    setPendingConfirm({
      message: t.host.confirmReset,
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        const sb = supabase();
        await sb.from("teams").delete().eq("game_id", gameId);
        await sb.from("load_snapshots").delete().eq("game_id", gameId);
        await sb
          .from("games")
          .update({ load: 0, running: false, started_at: null })
          .eq("id", gameId);
        setGame((prev) => ({
          ...prev,
          load: 0,
          running: false,
          started_at: null,
        }));
        setTeams([]);
        setLoadHistory([]);
        baseLoadRef.current = 0;
      },
    });
  };

  const deleteTeam = (id: string, name: string) => {
    setPendingConfirm({
      message: t.host.confirmDeleteTeam(name),
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        await supabase().from("teams").delete().eq("id", id);
      },
    });
  };

  // ─── Derived values ───────────────────────────────────────────────────
  const sortedTeams = [...teams].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );
  const maxScore = Math.max(1, ...sortedTeams.map((tm) => tm.score ?? 0));
  const champion = sortedTeams[0];

  const gameDuration = game.game_duration ?? 360;
  const elapsed = computeElapsed(game.started_at, game.running, now);
  const timeLeft = gameDuration - elapsed;
  const gameEnded =
    !game.running && !!game.started_at && elapsed >= gameDuration;

  const graphMax = Math.max(1, ...loadHistory);
  const graphPoints = loadHistory
    .map((v, i) => {
      const x = (i / Math.max(1, loadHistory.length - 1)) * 100;
      const y = 100 - (v / graphMax) * 95;
      return `${x},${y}`;
    })
    .join(" ");

  // ─── Loading / not found states ───────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400 dark:text-zinc-600 font-jb text-sm animate-pulse">
          {t.session.loading}
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
            {t.session.notFound}
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

  return (
    <>
      {showShareModal && (
        <ShareModal code={code} onClose={() => setShowShareModal(false)} />
      )}
      {pendingConfirm && (
        <ConfirmModal
          message={pendingConfirm.message}
          danger={pendingConfirm.danger}
          onConfirm={pendingConfirm.onConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      <main className="min-h-screen flex flex-col">
        {/* ─── Top bar ─────────────────────────────────────────────── */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-20">
          <BackButton className="shrink-0" />

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-jb hidden sm:block">
              Session
            </span>
            <span className="text-sm font-bold font-jb tracking-widest text-zinc-900 dark:text-zinc-100">
              {code}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${game.running ? "bg-emerald-500 animate-pulse" : gameEnded ? "bg-amber-500" : "bg-zinc-400 dark:bg-zinc-600"}`}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/60 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors text-xs font-jb"
            >
              <Share2 size={12} />
              <span className="hidden sm:block">Share</span>
            </button>
          </div>
        </header>

        {/* ─── Two-column layout ────────────────────────────────────── */}
        <div className="flex flex-col xl:flex-row flex-1">
          {/* ══ LEFT: Host Controls ══════════════════════════════════ */}
          <aside className="xl:w-96 xl:shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-4 space-y-4 xl:overflow-y-auto xl:h-[calc(100vh-49px)] xl:sticky xl:top-[49px]">
            {!isOwner && (
              <div className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-jb text-amber-600 dark:text-amber-400">
                {t.session.viewOnly}
              </div>
            )}

            {/* Game controls */}
            <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold">{t.host.gameStatus}</h2>
                  {game.started_at && (
                    <div
                      className={`flex items-center gap-1 text-xs font-jb tabular-nums ${timeLeft < 60 ? "text-red-500 dark:text-red-400" : timeLeft < 120 ? "text-amber-500 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-300"}`}
                    >
                      <Timer size={11} />
                      {gameEnded ? "0:00" : formatTime(timeLeft)}
                    </div>
                  )}
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1.5">
                    {game.running ? (
                      <button
                        onClick={pauseGame}
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-amber-500/50 hover:bg-amber-500/10 transition-colors text-xs font-jb"
                      >
                        <Pause size={11} /> {t.host.pause}
                      </button>
                    ) : (
                      <button
                        onClick={startGame}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 text-white dark:text-zinc-950 hover:bg-emerald-400 transition-colors text-xs font-jb"
                      >
                        <Play size={11} />{" "}
                        {game.started_at ? t.host.resume : t.host.start}
                      </button>
                    )}
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-red-500/50 hover:bg-red-500/10 text-red-500 dark:text-red-400 transition-colors text-xs font-jb"
                    >
                      <RotateCcw size={11} /> {t.host.reset}
                    </button>
                  </div>
                )}
              </div>

              {isOwner && (
                <>
                  <div className="mb-3">
                    <Slider
                      label={t.host.gameDuration}
                      value={gameDuration}
                      min={60}
                      max={1200}
                      step={60}
                      onChange={(v) => updateGame({ game_duration: v })}
                      unit="s"
                      hint={`${Math.floor(gameDuration / 60)} min`}
                      disabled={game.running || !!game.started_at}
                    />
                  </div>
                  <Slider
                    label={t.host.globalLoad}
                    value={game.load}
                    min={0}
                    max={game.max_load ?? 3000}
                    step={game.load_step ?? 50}
                    onChange={(v) => updateGame({ load: v })}
                    unit="req/s"
                    hint={t.host.loadHint}
                  />
                  <button
                    onClick={() => {
                      if (!fluctuate) baseLoadRef.current = game.load;
                      setFluctuate((v) => !v);
                    }}
                    disabled={!game.running}
                    className={`mt-3 flex items-center gap-1.5 px-2.5 py-1.5 border transition-colors text-xs font-jb disabled:opacity-40 disabled:cursor-not-allowed ${
                      fluctuate
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-zinc-300 dark:border-zinc-700 hover:border-amber-500 text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    <Zap size={11} />
                    {fluctuate ? t.host.fluctuateOn : t.host.fluctuateOff} ·
                    1×/s
                  </button>

                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-xs font-jb">
                    {[
                      {
                        load: 200,
                        label: "Phase 1",
                        sub: "200 req/s",
                        color: "text-emerald-500 dark:text-emerald-400",
                        hover: "hover:border-emerald-500",
                      },
                      {
                        load: 800,
                        label: "Phase 2",
                        sub: "800 req/s",
                        color: "text-amber-500 dark:text-amber-400",
                        hover: "hover:border-amber-500",
                      },
                      {
                        load: 1800,
                        label: "Phase 3",
                        sub: "1800 req/s",
                        color: "text-red-500 dark:text-red-400",
                        hover: "hover:border-red-500",
                      },
                    ].map((p) => (
                      <button
                        key={p.load}
                        onClick={() => updateGame({ load: p.load })}
                        className={`border border-zinc-300 dark:border-zinc-700 ${p.hover} py-2 transition-colors`}
                      >
                        <div className={p.color}>{p.label}</div>
                        <div className="text-zinc-500 text-[9px]">{p.sub}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Team list */}
            <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4">
              <h2 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Users size={12} /> {t.host.connectedTeams} ({teams.length})
              </h2>
              {sortedTeams.length === 0 ? (
                <p className="text-xs text-zinc-500 font-jb">
                  {t.host.noTeams}
                </p>
              ) : (
                <div className="space-y-1">
                  {sortedTeams.map((tm, i) => {
                    const stale = isStale(tm.last_seen);
                    return (
                      <div
                        key={tm.id}
                        className="flex items-center gap-2 text-xs font-jb py-1.5 border-b border-zinc-200/50 dark:border-zinc-800/50"
                      >
                        <span className="w-4 text-zinc-500 tabular-nums">
                          #{i + 1}
                        </span>
                        <span
                          className="w-2 h-2 shrink-0"
                          style={{ background: tm.color }}
                        />
                        <span className="flex-1 truncate text-zinc-700 dark:text-zinc-200 text-[11px]">
                          {tm.name}
                        </span>
                        {stale ? (
                          <WifiOff
                            size={10}
                            className="text-zinc-400 dark:text-zinc-600"
                          />
                        ) : (
                          <Wifi
                            size={10}
                            className="text-emerald-500 dark:text-emerald-400"
                          />
                        )}
                        <span className="tabular-nums text-zinc-700 dark:text-zinc-300 text-[11px]">
                          {fmt(tm.score)}
                        </span>
                        {isOwner && (
                          <button
                            onClick={() => deleteTeam(tm.id, tm.name)}
                            className="text-zinc-400 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-0.5"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

          {/* ══ RIGHT: Beamer View ═══════════════════════════════════ */}
          <section className="flex-1 p-5 lg:p-8 overflow-y-auto">
            {/* Header */}
            <div className="flex items-end justify-between mb-5 pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`w-2 h-2 ${game.running ? "bg-emerald-500 animate-pulse-mine" : gameEnded ? "bg-amber-500" : "bg-zinc-400 dark:bg-zinc-600"}`}
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
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
                  MINING{" "}
                  <span className="text-emerald-500 dark:text-emerald-400">
                    SHOWDOWN
                  </span>
                </h1>
              </div>

              <div className="flex items-end gap-4">
                {game.started_at && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                      <Timer size={10} /> Timer
                    </div>
                    <div
                      className={`text-4xl font-jb tabular-nums ${
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
                  </div>
                )}
                <button
                  onClick={() => setShowStrategies((v) => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 border transition-colors text-xs font-jb ${
                    showStrategies
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 text-zinc-500 dark:text-zinc-400"
                  }`}
                  title="Shortcut: S"
                >
                  {showStrategies ? <EyeOff size={12} /> : <Eye size={12} />}
                  <BookOpen size={12} />
                  <span className="hidden sm:block">{t.beamer.strategies}</span>
                  <kbd className="ml-0.5 px-1 py-0.5 border border-zinc-300 dark:border-zinc-700 text-[9px] text-zinc-500">
                    S
                  </kbd>
                </button>
              </div>
            </div>

            {/* Load + Graph */}
            <div className="mb-5 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4">
              <div className="flex items-start gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-1">
                    {t.beamer.globalLoad}
                  </div>
                  <div className="text-3xl font-jb tabular-nums text-amber-500 dark:text-amber-400">
                    {game.load}
                  </div>
                  <div className="text-xs text-zinc-500 font-jb mt-0.5">
                    req/s
                  </div>
                </div>
                {loadHistory.length > 2 && (
                  <div className="flex-1">
                    <div className="flex justify-between text-[9px] text-zinc-400 dark:text-zinc-600 font-jb mb-1">
                      <span>←120s</span>
                      <span>{graphMax} req/s</span>
                    </div>
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="w-full h-14"
                    >
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
                      {loadHistory.length > 0 && (
                        <circle
                          cx="100"
                          cy={
                            100 -
                            (loadHistory[loadHistory.length - 1] / graphMax) *
                              95
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

            {/* Empty state / Game Over / Live leaderboard */}
            {sortedTeams.length === 0 ? (
              <div className="text-center py-24">
                <Users
                  size={40}
                  className="text-zinc-300 dark:text-zinc-700 mx-auto mb-3 animate-pulse"
                />
                <div className="text-xl text-zinc-400 dark:text-zinc-600 font-jb">
                  {t.beamer.waitingTeams}
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-700 mt-2 font-jb">
                  {t.beamer.waitingHint}
                </div>
              </div>
            ) : gameEnded ? (
              <>
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Trophy
                      size={18}
                      className="text-amber-500 dark:text-amber-400"
                    />
                    <span className="text-xs uppercase tracking-[0.4em] text-amber-500 dark:text-amber-400 font-jb">
                      {t.beamer.finalResults}
                    </span>
                    <Trophy
                      size={18}
                      className="text-amber-500 dark:text-amber-400"
                    />
                  </div>
                </div>

                {/* Podium */}
                <div className="flex items-end justify-center gap-3 mb-6">
                  {sortedTeams[1] && (
                    <div
                      className="flex-1 max-w-xs border-2 p-4 text-center"
                      style={{ borderColor: sortedTeams[1].color }}
                    >
                      <div className="text-xl font-bold font-jb text-zinc-400 dark:text-zinc-500 mb-1">
                        #2
                      </div>
                      <div
                        className="w-2.5 h-2.5 mx-auto mb-1.5"
                        style={{ background: sortedTeams[1].color }}
                      />
                      <div className="text-lg font-semibold truncate">
                        {sortedTeams[1].name}
                      </div>
                      <div
                        className="text-2xl font-bold font-jb tabular-nums mt-1"
                        style={{ color: sortedTeams[1].color }}
                      >
                        {fmt(sortedTeams[1].score)}
                      </div>
                      <div className="text-[9px] text-zinc-500 font-jb mt-0.5">
                        {STRATEGIES[classifyStrategy(sortedTeams[1].cfg)].short}
                      </div>
                    </div>
                  )}
                  {sortedTeams[0] && (
                    <div
                      className="flex-1 max-w-sm border-2 p-5 text-center relative overflow-hidden"
                      style={{
                        borderColor: sortedTeams[0].color,
                        background: `linear-gradient(180deg, ${sortedTeams[0].color}20, transparent)`,
                      }}
                    >
                      <Crown
                        size={18}
                        className="mx-auto mb-1.5"
                        style={{ color: sortedTeams[0].color }}
                      />
                      <div
                        className="text-3xl font-bold font-jb mb-1.5"
                        style={{ color: sortedTeams[0].color }}
                      >
                        #1
                      </div>
                      <div
                        className="w-3 h-3 mx-auto mb-1.5"
                        style={{ background: sortedTeams[0].color }}
                      />
                      <div className="text-xl font-semibold truncate">
                        {sortedTeams[0].name}
                      </div>
                      <div
                        className="text-4xl font-bold font-jb tabular-nums mt-1.5"
                        style={{ color: sortedTeams[0].color }}
                      >
                        {fmt(sortedTeams[0].score)}
                      </div>
                      <div className="text-[9px] text-zinc-500 font-jb mt-0.5">
                        {STRATEGIES[classifyStrategy(sortedTeams[0].cfg)].short}
                      </div>
                    </div>
                  )}
                  {sortedTeams[2] && (
                    <div
                      className="flex-1 max-w-xs border-2 p-3 text-center"
                      style={{ borderColor: sortedTeams[2].color }}
                    >
                      <div className="text-xl font-bold font-jb text-zinc-400 dark:text-zinc-500 mb-1">
                        #3
                      </div>
                      <div
                        className="w-2.5 h-2.5 mx-auto mb-1.5"
                        style={{ background: sortedTeams[2].color }}
                      />
                      <div className="text-lg font-semibold truncate">
                        {sortedTeams[2].name}
                      </div>
                      <div
                        className="text-2xl font-bold font-jb tabular-nums mt-1"
                        style={{ color: sortedTeams[2].color }}
                      >
                        {fmt(sortedTeams[2].score)}
                      </div>
                      <div className="text-[9px] text-zinc-500 font-jb mt-0.5">
                        {STRATEGIES[classifyStrategy(sortedTeams[2].cfg)].short}
                      </div>
                    </div>
                  )}
                </div>

                {sortedTeams.length > 3 && (
                  <div className="space-y-1 mb-6">
                    {sortedTeams.slice(3).map((tm, i) => (
                      <div
                        key={tm.id}
                        className="flex items-center gap-3 text-sm font-jb text-zinc-500 py-1.5 border-b border-zinc-200/50 dark:border-zinc-800/50"
                      >
                        <span className="w-5 tabular-nums">#{i + 4}</span>
                        <span
                          className="w-2 h-2"
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
                {/* Champion banner */}
                {champion && champion.score > 0 && (
                  <div
                    className="mb-5 border-2 p-5 lg:p-6 relative overflow-hidden"
                    style={{
                      borderColor: champion.color,
                      background: `linear-gradient(90deg, ${champion.color}15, transparent)`,
                    }}
                  >
                    <div
                      className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] uppercase tracking-widest font-jb"
                      style={{ color: champion.color }}
                    >
                      <Crown size={10} /> {t.beamer.currentLeader} ·{" "}
                      {STRATEGIES[classifyStrategy(champion.cfg)].short}
                    </div>
                    <div className="flex items-center gap-5 flex-wrap">
                      <div
                        className="text-6xl lg:text-7xl font-bold font-jb tabular-nums"
                        style={{ color: champion.color }}
                      >
                        #1
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <div className="text-2xl lg:text-3xl font-bold tracking-tight">
                          {champion.name}
                        </div>
                        <div className="text-xs text-zinc-500 font-jb mt-1">
                          ${(champion.cost ?? 0).toFixed(0)}/h ·{" "}
                          {champion.cpu_percent ?? 0}% CPU ·{" "}
                          {Math.round(champion.throughput ?? 0)} req/s
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb">
                          {t.beamer.coinsMined}
                        </div>
                        <div
                          className="text-5xl lg:text-6xl font-bold font-jb tabular-nums"
                          style={{ color: champion.color }}
                        >
                          {fmt(champion.score)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Leaderboard */}
                <div className="space-y-2 mb-6">
                  {sortedTeams.map((tm, i) => {
                    const widthPct = ((tm.score ?? 0) / maxScore) * 100;
                    const stale = isStale(tm.last_seen);
                    const inTrouble = tm.over_budget || (tm.dropped ?? 0) > 5;
                    const strategy = STRATEGIES[classifyStrategy(tm.cfg)];

                    return (
                      <div
                        key={tm.id}
                        className={`relative border ${i === 0 ? "border-zinc-300 dark:border-zinc-700" : "border-zinc-200 dark:border-zinc-800"} bg-zinc-100/50 dark:bg-zinc-900/30 overflow-hidden ${stale ? "opacity-40" : ""}`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 transition-all duration-1000"
                          style={{
                            width: `${widthPct}%`,
                            background: `${tm.color}15`,
                          }}
                        />
                        <div className="relative flex items-center gap-3 px-4 py-3">
                          <div
                            className="text-2xl lg:text-3xl font-bold font-jb tabular-nums w-10"
                            style={{ color: tm.color }}
                          >
                            {i + 1}
                          </div>
                          <div
                            className="w-1 h-9"
                            style={{ background: tm.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg font-semibold truncate">
                                {tm.name}
                              </span>
                              {showStrategies && (
                                <span
                                  className="text-[10px] font-jb uppercase tracking-widest px-1 py-0.5 border"
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
                                  size={12}
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
                            <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-jb mt-0.5 flex-wrap">
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
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div
                              className="text-2xl lg:text-3xl font-bold font-jb tabular-nums"
                              style={{
                                color: inTrouble ? "#ef4444" : tm.color,
                              }}
                            >
                              {fmt(tm.score)}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-jb">
                              {Math.round(tm.throughput ?? 0)}/s
                              {(tm.dropped ?? 0) > 1 && (
                                <span className="text-red-500 dark:text-red-400 ml-1">
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

                {showStrategies && <StrategyPanel teams={teams} />}
              </>
            )}

            <footer className="mt-8 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-700 font-jb">
              <span>
                {t.beamer.labFooter} · {t.beamer.teams(sortedTeams.length)}
              </span>
              <span>
                {gameEnded
                  ? t.beamer.ended
                  : game.running
                    ? t.beamer.liveStatus
                    : t.beamer.pausedStatus}{" "}
                · {t.beamer.scoreFooter}
              </span>
            </footer>
          </section>
        </div>
      </main>
    </>
  );
}
