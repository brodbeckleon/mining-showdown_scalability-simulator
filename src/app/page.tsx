import Link from "next/link";
import { Tv, Gamepad2, Users } from "lucide-react";
import { CONSTANTS } from "@/lib/simulation";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 bg-emerald-500 animate-pulse-mine" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-400 font-jb">
              ASE2 — Scalability Multiplayer
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Mining Farm <span className="text-emerald-400">Showdown</span>
          </h1>
          <p className="text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            Wer baut die effizienteste Mining-Infrastruktur unter Last? Jedes
            Team hat das gleiche Budget. Wer am klügsten skaliert — vertikal,
            horizontal oder mit Sharding — gewinnt.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/beamer"
            className="group border border-zinc-800 bg-zinc-900/30 p-6 hover:border-emerald-500 transition-all"
          >
            <Tv size={28} className="text-emerald-400 mb-4" />
            <h2 className="text-lg font-semibold mb-1.5">Beamer</h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-jb">
              Leaderboard für die Projektion. Live-Ranking aller Teams.
            </p>
          </Link>

          <Link
            href="/team"
            className="group border border-zinc-800 bg-zinc-900/30 p-6 hover:border-emerald-500 transition-all"
          >
            <Gamepad2 size={28} className="text-emerald-400 mb-4" />
            <h2 className="text-lg font-semibold mb-1.5">Team beitreten</h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-jb">
              Mitspielen vom Laptop oder Handy. Topologie, Sliders, Live-Score.
            </p>
          </Link>

          <Link
            href="/host"
            className="group border border-zinc-800 bg-zinc-900/30 p-6 hover:border-amber-500 transition-all"
          >
            <Users size={28} className="text-amber-400 mb-4" />
            <h2 className="text-lg font-semibold mb-1.5">Host</h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-jb">
              Spielleitung. Last steuern, Spiel starten oder zurücksetzen.
            </p>
          </Link>
        </div>

        <div className="mt-10 border border-zinc-800 bg-zinc-900/20 p-4">
          <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-jb mb-2">
            Spielablauf
          </h3>
          <ol className="text-xs text-zinc-400 space-y-1.5 font-jb">
            <li>
              <span className="text-emerald-400">1.</span> Host öffnet die
              Beamer-Ansicht und projiziert sie.
            </li>
            <li>
              <span className="text-emerald-400">2.</span> Teams öffnen die
              Team-Ansicht auf ihren Geräten und treten mit Namen bei.
            </li>
            <li>
              <span className="text-emerald-400">3.</span> Host startet das
              Spiel und passt die Last über die Zeit an.
            </li>
            <li>
              <span className="text-emerald-400">4.</span> Teams konfigurieren
              Ressourcen innerhalb von{" "}
              <span className="text-emerald-400">
                ${CONSTANTS.TEAM_BUDGET}/h
              </span>{" "}
              Budget — wer drüber liegt, kommt nicht online.
            </li>
            <li>
              <span className="text-emerald-400">5.</span> Score = kumulierte
              erfolgreich verarbeitete Anfragen. Drops = verlorenes Geld.
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
