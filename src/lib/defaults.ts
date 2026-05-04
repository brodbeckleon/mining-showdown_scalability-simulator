// ─────────────────────────────────────────────────────────────────────────────
// Shared default values
// ─────────────────────────────────────────────────────────────────────────────

import { GAME_ID } from "@/lib/supabase";
import type { GameRow, TeamConfig } from "@/lib/types";

export const DEFAULT_GAME: GameRow = {
  id: GAME_ID,
  load: 200,
  running: false,
  started_at: null,
  created_at: new Date().toISOString(),
};

export const DEFAULT_CFG: TeamConfig = {
  cpuPerNode: 4,
  ramPerNode: 8,
  nodeCount: 1,
  loadBalancer: false,
  shards: 1,
};
