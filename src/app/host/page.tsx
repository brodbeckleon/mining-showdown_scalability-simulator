"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Slider } from "@/components/Slider";
import { supabase, GAME_ID } from "@/lib/supabase";
import { fmt, isStale } from "@/lib/colors";
import type { GameRow, TeamRow } from "@/lib/types";

const DEFAULT_GAME: GameRow = {
  id: GAME_ID,
  load: 300,
  running: false,
  started_at: null,
  created_at: new Date().toISOString(),
};

export default function HostPage() {
  const [game, setGame] = useState<GameRow>(DEFAULT_GAME);
  const [teams, setTeams] = useState<TeamRow[]>([]);

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

  const updateGame = async (patch: Partial<GameRow>) => {
    setGame((prev) => ({ ...prev, ...patch }));
    await supabase().from("games").update(patch).eq("id", GAME_ID);
  };

  const startGame = () =>
    updateGame({ running: true, started_at: new Date().toISOString() });
  const pauseGame = () => updateGame({ running: false });

  const handleReset = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Alle Teams und Spielstand löschen?")
    )
      return;
    const sb = supabase();
    // RPC, falls sie existiert; fallback auf direktes Löschen
    const { error: rpcError } = await sb.rpc("reset_game");
    if (rpcError) {
      await sb.from("teams").delete().eq("game_id", GAME_ID);
      await sb
        .from("games")
        .update({ load: 300, running: false, started_at: null })
        .eq("id", GAME_ID);
    }
    setGame({ ...DEFAULT_GAME, running: false, started_at: null });
    setTeams([]);
  };

  const deleteTeam = async (id: string, name: string) => {
    if (!window.confirm(`Team "${name}" löschen?`)) return;
    await supabase().from("teams").delete().eq("id", id);
  };

  const sortedTeams = [...teams].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );

  return (
    <main className="min-h-screen p-5">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 font-jb mb-4"
        >
          <ArrowLeft size={12} /> zurück
        </Link>

        <header className="mb-5 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-amber-400" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-amber-400 font-jb">
              Host Console
            </span>
          </div>
          <h1 className="text-2xl font-semibold">Spielleitung</h1>
          <p className="text-xs text-zinc-500 font-jb mt-1">
            {teams.length} Team{teams.length !== 1 ? "s" : ""} verbunden ·{" "}
            <span
              className={game.running ? "text-emerald-400" : "text-zinc-500"}
            >
              {game.running ? "läuft" : "pausiert"}
            </span>
          </p>
        </header>

        {/* ─── Spielsteuerung ────────────────────────────────────────── */}
        <section className="border border-zinc-800 bg-zinc-900/30 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Spielstatus</h2>
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors text-xs font-jb"
                >
                  <Play size={12} /> Start
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/50 hover:bg-red-500/10 text-red-400 transition-colors text-xs font-jb"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>

          <Slider
            label="Globale Last (alle Teams)"
            value={game.load}
            min={50}
            max={3000}
            step={50}
            onChange={(v) => updateGame({ load: v })}
            unit="req/s"
            hint="Ändere die Last während des Spiels — Teams müssen darauf reagieren."
          />

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-jb">
            <button
              onClick={() => updateGame({ load: 200 })}
              className="border border-zinc-700 hover:border-emerald-500 py-2 transition-colors"
            >
              <div className="text-emerald-400">Phase 1</div>
              <div className="text-zinc-500 text-[10px]">200 req/s · easy</div>
            </button>
            <button
              onClick={() => updateGame({ load: 800 })}
              className="border border-zinc-700 hover:border-amber-500 py-2 transition-colors"
            >
              <div className="text-amber-400">Phase 2</div>
              <div className="text-zinc-500 text-[10px]">
                800 req/s · brutal
              </div>
            </button>
            <button
              onClick={() => updateGame({ load: 1800 })}
              className="border border-zinc-700 hover:border-red-500 py-2 transition-colors"
            >
              <div className="text-red-400">Phase 3</div>
              <div className="text-zinc-500 text-[10px]">
                1800 req/s · chaos
              </div>
            </button>
          </div>
        </section>

        {/* ─── Teams ────────────────────────────────────────────────── */}
        <section className="border border-zinc-800 bg-zinc-900/30 p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users size={14} /> Verbundene Teams
          </h2>
          {sortedTeams.length === 0 ? (
            <p className="text-xs text-zinc-500 font-jb">
              Noch niemand beigetreten. Teile den Link zur /team-Seite.
            </p>
          ) : (
            <div className="space-y-1.5">
              {sortedTeams.map((t, i) => {
                const stale = isStale(t.last_seen);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 text-xs font-jb py-1.5 border-b border-zinc-800/50"
                  >
                    <span className="w-5 text-zinc-500 tabular-nums">
                      #{i + 1}
                    </span>
                    <span
                      className="w-2.5 h-2.5"
                      style={{ background: t.color }}
                    />
                    <span className="flex-1 truncate text-zinc-200">
                      {t.name}
                    </span>
                    {stale ? (
                      <WifiOff size={11} className="text-zinc-600" />
                    ) : (
                      <Wifi size={11} className="text-emerald-400" />
                    )}
                    <span className="tabular-nums w-20 text-right text-zinc-300">
                      {fmt(t.score)}
                    </span>
                    <span className="tabular-nums w-16 text-right text-zinc-500">
                      ${(t.cost ?? 0).toFixed(0)}/h
                    </span>
                    <span
                      className={`tabular-nums w-16 text-right font-jb ${t.over_budget ? "text-red-400" : (t.wallet ?? 100) < 20 ? "text-amber-400" : "text-zinc-500"}`}
                    >
                      {t.over_budget
                        ? "BKRPT"
                        : `${(t.wallet ?? 100).toFixed(0)}c`}
                    </span>
                    <button
                      onClick={() => deleteTeam(t.id, t.name)}
                      className="ml-1 text-zinc-700 hover:text-red-400 transition-colors"
                      title="Team löschen"
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
