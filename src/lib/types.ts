// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type TeamConfig = {
  cpuPerNode: number;
  ramPerNode: number;
  nodeCount: number;
  loadBalancer: boolean;
  shards: number;
};

export type GameRow = {
  id: string;
  load: number;
  running: boolean;
  started_at: string | null;
  created_at: string;
  max_load?: number; // optional – Fallback auf DEFAULT_GAME wenn nicht in DB
  load_step?: number; // optional – Fallback auf DEFAULT_GAME wenn nicht in DB
  game_duration?: number; // Spielzeit in Sekunden, optional
};

export type TeamRow = {
  id: string;
  game_id: string;
  name: string;
  color: string;
  cfg: TeamConfig;
  score: number;
  wallet: number;
  cost: number;
  throughput: number;
  dropped: number;
  response_time: number;
  cpu_percent: number;
  ram_percent: number;
  deployed: boolean;
  over_budget: boolean;
  last_seen: string;
  created_at: string;
};

export type LoadSnapshot = {
  id: number;
  game_id: string;
  load: number;
  recorded_at: string;
};

export type Metrics = {
  cost: number;
  throughput: number;
  dropped: number;
  responseTime: number;
  cpuPercent: number;
  ramPercent: number;
  cpuCapacity: number;
  dbCapacity: number;
  appUtil: number;
  dbUtil: number;
  inflight: number;
  totalCores: number;
  totalRamMB: number;
  activeNodes: number;
  bottleneck: "none" | "app" | "db" | "app-warn" | "db-warn";
};

export type StrategyKey =
  | "baseline"
  | "vertical"
  | "noLB"
  | "loadBalanced"
  | "combined"
  | "sharded";
