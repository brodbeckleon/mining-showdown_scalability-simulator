// ─────────────────────────────────────────────────────────────────────────────
// Shared default values
// ─────────────────────────────────────────────────────────────────────────────

import { GAME_ID } from "@/lib/supabase";
import type { GameRow, TeamConfig } from "@/lib/types";

export const DEFAULT_GAME: GameRow = {
  id: GAME_ID,
  load: 0,
  running: false,
  started_at: null,
  created_at: new Date().toISOString(),
  load_step: 50,
  max_load: 3000,
  game_duration: 360,
};

export const DEFAULT_CFG: TeamConfig = {
  cpuPerNode: 2,
  ramPerNode: 2,
  nodeCount: 1,
  loadBalancer: false,
  shards: 1,
};
