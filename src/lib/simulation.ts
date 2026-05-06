// ─────────────────────────────────────────────────────────────────────────────
// Simulation model
// ─────────────────────────────────────────────────────────────────────────────
// Vereinfachtes M/M/1-ähnliches Modell pro Tier. Zweck: Skalierungseffekte
// anschaulich machen, nicht exakte Performance-Vorhersage.

import type { TeamConfig, Metrics } from "./types";

export const CONSTANTS = {
  CORE_CAP: 32, // req/s pro CPU-Kern
  RAM_PER_REQ: 400, // MB pro in-flight Request
  DB_CAP_PER_SHARD: 850, // req/s pro Shard
  APP_BASE_MS: 18, // Basis-Latenz Application-Tier
  DB_BASE_MS: 8, // Basis-Latenz Data-Tier
  COST_CORE: 6, // $/h pro Kern
  COST_GB_RAM: 4, // $/h pro GB
  COST_LB: 12, // $/h für Load Balancer
  COST_SHARD: 9, // $/h pro Shard
  TEAM_BUDGET: 80, // Startkapital (Coins)
  EARN_RATE: 0.006, // Coins pro erfolgreich verarbeitetem Request
  SPEND_RATE: 0.01, // Coins pro $/h Infrastruktur pro Sekunde
} as const;

export function computeMetrics(cfg: TeamConfig, load: number): Metrics {
  const C = CONSTANTS;
  const activeNodes = cfg.loadBalancer ? cfg.nodeCount : 1;
  const totalCores = activeNodes * cfg.cpuPerNode;
  const totalRamMB = activeNodes * cfg.ramPerNode * 1024;
  const cpuCapacity = totalCores * C.CORE_CAP;
  const dbCapacity = cfg.shards * C.DB_CAP_PER_SHARD;

  const appUtil = load / cpuCapacity;
  const dbUtil = load / dbCapacity;

  // Engpass-Diagnose
  let bottleneck: Metrics["bottleneck"] = "none";
  if (appUtil >= 0.95 || dbUtil >= 0.95) {
    bottleneck = appUtil >= dbUtil ? "app" : "db";
  } else if (appUtil > 0.7 || dbUtil > 0.7) {
    bottleneck = appUtil >= dbUtil ? "app-warn" : "db-warn";
  }

  // M/M/1-Approximation pro Tier: RT = base / (1 - utilization)
  const cap = (u: number) => Math.max(0.01, 1 - Math.min(0.985, u));
  const responseTime =
    C.APP_BASE_MS / cap(appUtil) + C.DB_BASE_MS / cap(dbUtil);

  // Little's Law: in-flight = arrival_rate * RT
  const inflight = load * (responseTime / 1000);
  const ramUsedMB = inflight * C.RAM_PER_REQ;
  const ramPercent = Math.min(150, (ramUsedMB / totalRamMB) * 100);
  const cpuPercent = Math.min(100, appUtil * 100);

  // Tatsächlicher Durchsatz: durch das schwächere Tier begrenzt.
  // RAM-Overflow drosselt zusätzlich.
  let throughput = Math.min(load, Math.min(cpuCapacity, dbCapacity));
  if (ramPercent > 100) throughput *= 100 / ramPercent;
  const dropped = Math.max(0, load - throughput);

  const cost =
    cfg.nodeCount *
      (cfg.cpuPerNode * C.COST_CORE + cfg.ramPerNode * C.COST_GB_RAM) +
    (cfg.loadBalancer ? C.COST_LB : 0) +
    cfg.shards * C.COST_SHARD;

  return {
    cost,
    throughput,
    dropped,
    responseTime,
    cpuPercent,
    ramPercent,
    cpuCapacity,
    dbCapacity,
    appUtil,
    dbUtil,
    inflight,
    totalCores,
    totalRamMB,
    activeNodes,
    bottleneck,
  };
}
