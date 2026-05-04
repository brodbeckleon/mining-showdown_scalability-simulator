// ─────────────────────────────────────────────────────────────────────────────
// Supabase browser client
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Bewusst ein lauter Fehler, damit fehlende Env-Vars früh auffallen.
  // Wird nur clientseitig ausgeführt, wenn die Env-Datei nicht ausgeliefert wird.
   
  console.warn(
    "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  client = createClient(url ?? "", key ?? "", {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

// Singleton-Game UUID — passt zur Schema-Datei.
export const GAME_ID = "00000000-0000-0000-0000-000000000001";
