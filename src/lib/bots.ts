import type { TeamConfig } from "./types";
import { CONSTANTS } from "./simulation";

export type BotDifficulty = "easy" | "medium" | "hard";

export type BotState = {
  id: string;
  name: string;
  cfg: TeamConfig;
  score: number;
  wallet: number;
  color: string;
  strategy: "vertical" | "horizontal" | "balanced" | "sharding";
  upgradeStep: number;
};

const START_CFG: TeamConfig = {
  cpuPerNode: 2,
  ramPerNode: 2,
  nodeCount: 1,
  loadBalancer: false,
  shards: 1,
};

// Each strategy has its own upgrade ladder — bots advance one step at a time.
const UPGRADE_PATHS: Record<string, TeamConfig[]> = {
  vertical: [
    START_CFG,
    { cpuPerNode: 4, ramPerNode: 8, nodeCount: 1, loadBalancer: false, shards: 1 },
    { cpuPerNode: 8, ramPerNode: 16, nodeCount: 1, loadBalancer: false, shards: 2 },
    { cpuPerNode: 12, ramPerNode: 32, nodeCount: 1, loadBalancer: false, shards: 2 },
    { cpuPerNode: 16, ramPerNode: 64, nodeCount: 1, loadBalancer: false, shards: 3 },
    { cpuPerNode: 16, ramPerNode: 64, nodeCount: 2, loadBalancer: true, shards: 4 },
    { cpuPerNode: 16, ramPerNode: 64, nodeCount: 3, loadBalancer: true, shards: 5 },
  ],
  horizontal: [
    START_CFG,
    { cpuPerNode: 2, ramPerNode: 4, nodeCount: 2, loadBalancer: true, shards: 1 },
    { cpuPerNode: 4, ramPerNode: 8, nodeCount: 3, loadBalancer: true, shards: 1 },
    { cpuPerNode: 4, ramPerNode: 8, nodeCount: 4, loadBalancer: true, shards: 2 },
    { cpuPerNode: 6, ramPerNode: 16, nodeCount: 5, loadBalancer: true, shards: 3 },
    { cpuPerNode: 8, ramPerNode: 16, nodeCount: 6, loadBalancer: true, shards: 4 },
    { cpuPerNode: 10, ramPerNode: 32, nodeCount: 6, loadBalancer: true, shards: 5 },
  ],
  balanced: [
    START_CFG,
    { cpuPerNode: 4, ramPerNode: 8, nodeCount: 2, loadBalancer: true, shards: 1 },
    { cpuPerNode: 6, ramPerNode: 16, nodeCount: 2, loadBalancer: true, shards: 2 },
    { cpuPerNode: 8, ramPerNode: 16, nodeCount: 3, loadBalancer: true, shards: 3 },
    { cpuPerNode: 10, ramPerNode: 32, nodeCount: 4, loadBalancer: true, shards: 4 },
    { cpuPerNode: 12, ramPerNode: 32, nodeCount: 5, loadBalancer: true, shards: 5 },
    { cpuPerNode: 14, ramPerNode: 48, nodeCount: 6, loadBalancer: true, shards: 6 },
  ],
  sharding: [
    START_CFG,
    { cpuPerNode: 4, ramPerNode: 8, nodeCount: 1, loadBalancer: false, shards: 3 },
    { cpuPerNode: 6, ramPerNode: 16, nodeCount: 1, loadBalancer: false, shards: 4 },
    { cpuPerNode: 8, ramPerNode: 16, nodeCount: 2, loadBalancer: true, shards: 5 },
    { cpuPerNode: 10, ramPerNode: 32, nodeCount: 3, loadBalancer: true, shards: 6 },
    { cpuPerNode: 12, ramPerNode: 32, nodeCount: 4, loadBalancer: true, shards: 6 },
    { cpuPerNode: 14, ramPerNode: 48, nodeCount: 5, loadBalancer: true, shards: 6 },
  ],
};

export const DIFFICULTY_CONFIG: Record<
  BotDifficulty,
  {
    bots: number;
    upgradeIntervalMs: number;
    maxStep: number;
    names: string[];
    colors: string[];
    loadStep: number;
    loadIntervalMs: number;
    label: string;
    hint: string;
  }
> = {
  easy: {
    bots: 2,
    upgradeIntervalMs: 90_000,
    maxStep: 3,
    names: ["Nova", "Pixel"],
    colors: ["#f87171", "#fb923c"],
    loadStep: 100,
    loadIntervalMs: 45_000,
    label: "Easy",
    hint: "2 bots · load +100/45s · bots upgrade every 90s",
  },
  medium: {
    bots: 3,
    upgradeIntervalMs: 45_000,
    maxStep: 5,
    names: ["Vector", "Quasar", "Lyra"],
    colors: ["#f87171", "#fb923c", "#a78bfa"],
    loadStep: 150,
    loadIntervalMs: 30_000,
    label: "Medium",
    hint: "3 bots · load +150/30s · bots upgrade every 45s",
  },
  hard: {
    bots: 4,
    upgradeIntervalMs: 20_000,
    maxStep: 6,
    names: ["Nexus", "Cipher", "Vega", "Axis"],
    colors: ["#f87171", "#fb923c", "#a78bfa", "#60a5fa"],
    loadStep: 200,
    loadIntervalMs: 20_000,
    label: "Hard",
    hint: "4 bots · load +200/20s · bots upgrade every 20s",
  },
};

const STRATEGIES = [
  "vertical",
  "horizontal",
  "balanced",
  "sharding",
] as const;

export const STRATEGY_LABELS: Record<BotState["strategy"], string> = {
  vertical: "VERT",
  horizontal: "HORIZ",
  balanced: "BAL",
  sharding: "SHARD",
};

export function createBots(difficulty: BotDifficulty): BotState[] {
  const dc = DIFFICULTY_CONFIG[difficulty];
  return dc.names.map((name, i) => ({
    id: `bot-${i}`,
    name,
    cfg: { ...START_CFG },
    score: 0,
    wallet: CONSTANTS.TEAM_BUDGET,
    color: dc.colors[i],
    strategy: STRATEGIES[i % STRATEGIES.length],
    upgradeStep: 0,
  }));
}

export function getBotConfig(
  bot: BotState,
  step: number,
  difficulty: BotDifficulty,
): TeamConfig {
  const maxStep = DIFFICULTY_CONFIG[difficulty].maxStep;
  const clampedStep = Math.min(step, maxStep);
  const path = UPGRADE_PATHS[bot.strategy];
  return path[Math.min(clampedStep, path.length - 1)];
}
