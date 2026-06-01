"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Timer, Users } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Slider } from "@/components/Slider";
import { supabase } from "@/lib/supabase";
import { generateSessionCode } from "@/lib/session-codes";

export default function CreatePageClient() {
  const router = useRouter();
  const [gameDuration, setGameDuration] = useState(360);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    setCreating(true);
    setError(null);
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateSessionCode();
        const { data, error: insertError } = await supabase()
          .from("games")
          .insert({
            code,
            load: 0,
            running: false,
            started_at: null,
            max_load: 3000,
            load_step: 50,
            game_duration: gameDuration,
          })
          .select("id")
          .single();

        if (!insertError && data) {
          sessionStorage.setItem(`session_owner_${code}`, data.id as string);
          router.push(`/session/${code}`);
          return;
        }
      }
      setError("Could not create a unique session code. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <BackButton className="mb-6" />

        <div className="flex items-center gap-2 mb-1">
          <Timer size={14} className="text-amber-500 dark:text-amber-400" />
          <span className="text-[11px] uppercase tracking-[0.3em] text-amber-500 dark:text-amber-400 font-jb">
            Multiplayer
          </span>
        </div>
        <h1 className="text-2xl font-semibold mb-1">Host a Game</h1>
        <p className="text-xs text-zinc-500 font-jb mb-8">
          Create a private session and invite others with a unique join link and
          QR code.
        </p>

        <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-5 mb-5">
          <Slider
            label="Game Duration"
            value={gameDuration}
            min={60}
            max={1200}
            step={60}
            onChange={setGameDuration}
            unit="s"
            hint={`${Math.floor(gameDuration / 60)} min`}
          />
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 p-4 mb-5 text-xs font-jb text-zinc-500 space-y-1.5">
          <div className="flex items-center gap-2">
            <Users size={11} className="text-amber-500 dark:text-amber-400" />
            <span>
              Players join at{" "}
              <span className="text-zinc-700 dark:text-zinc-300">
                /join/[code]
              </span>
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-600">
            You will be the only one with host controls. The shareable QR code
            and link are shown on your session page.
          </div>
        </div>

        {error && (
          <div className="border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-400 font-jb mb-4">
            {error}
          </div>
        )}

        <button
          onClick={createSession}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 disabled:opacity-60 text-white dark:text-zinc-950 font-medium py-3 hover:bg-amber-400 transition-colors font-jb text-sm"
        >
          <Plus size={14} />
          {creating ? "Creating..." : "Create Session"}
        </button>
      </div>
    </main>
  );
}
