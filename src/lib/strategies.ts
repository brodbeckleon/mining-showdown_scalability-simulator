// ─────────────────────────────────────────────────────────────────────────────
// Skalierungsstrategien aus der ASE2-Arbeit
// ─────────────────────────────────────────────────────────────────────────────
// Diese sechs Strategien spiegeln Bondis Unterscheidung von load- und
// structural scalability sowie die Eingrenzung des praktischen Teils:
// Vertical Scaling, Load Balancing, deren Kombination, plus Sharding als
// Erweiterung für datenintensive Systeme.

import type { TeamConfig, StrategyKey } from "./types";

export type Strategy = {
  key: StrategyKey;
  label: string;
  short: string;
  desc: string;
  cfg: TeamConfig;
  pros: string;
  cons: string;
  color: string;
};

export const STRATEGIES: Record<StrategyKey, Strategy> = {
  baseline: {
    key: "baseline",
    label: "Ausgangszustand",
    short: "Baseline",
    desc: "Eine Node, minimale Ressourcen — günstig, aber sofort Engpass bei steigender Last.",
    cfg: {
      cpuPerNode: 2,
      ramPerNode: 4,
      nodeCount: 1,
      loadBalancer: false,
      shards: 1,
    },
    pros: "Billig, einfach.",
    cons: "Kein Wachstumspfad.",
    color: "#71717a",
  },
  vertical: {
    key: "vertical",
    label: "Vertical Scaling",
    short: "Vertical",
    desc: "Eine Node, aber mehr CPU & RAM. Hilft bis zur Hardware-Grenze.",
    cfg: {
      cpuPerNode: 12,
      ramPerNode: 24,
      nodeCount: 1,
      loadBalancer: false,
      shards: 1,
    },
    pros: "Schnell zu implementieren, keine Architekturänderung.",
    cons: "Single Point of Failure, irgendwann Hardware-Limit.",
    color: "#06b6d4",
  },
  noLB: {
    key: "noLB",
    label: "Mehr Nodes ohne LB",
    short: "Misconfig",
    desc: "Klassischer Fehler: Nodes da, aber kein Load Balancer — die erste ackert, der Rest steht.",
    cfg: {
      cpuPerNode: 4,
      ramPerNode: 8,
      nodeCount: 4,
      loadBalancer: false,
      shards: 1,
    },
    pros: "—",
    cons: "Geld verbrannt, Engpass bleibt.",
    color: "#ef4444",
  },
  loadBalanced: {
    key: "loadBalanced",
    label: "Load Balancing",
    short: "Load-Balanced",
    desc: "Mehrere Nodes hinter einem Load Balancer. Last gleichmässig verteilt.",
    cfg: {
      cpuPerNode: 4,
      ramPerNode: 8,
      nodeCount: 4,
      loadBalancer: true,
      shards: 1,
    },
    pros: "Horizontal skalierbar, Ausfallsicherheit.",
    cons: "Datenbank kann zum neuen Engpass werden.",
    color: "#10b981",
  },
  combined: {
    key: "combined",
    label: "Kombiniert",
    short: "Combined",
    desc: "Vertical + Horizontal. Solides App-Tier — aber DB ist noch nicht entlastet.",
    cfg: {
      cpuPerNode: 8,
      ramPerNode: 16,
      nodeCount: 4,
      loadBalancer: true,
      shards: 1,
    },
    pros: "Hohe App-Kapazität.",
    cons: "Teuer; bei datenintensiver Last nicht ausreichend.",
    color: "#8b5cf6",
  },
  sharded: {
    key: "sharded",
    label: "Mit Sharding",
    short: "Sharded",
    desc: "Erweiterung: DB-Last über mehrere Shards verteilt — entlastet das Data-Tier.",
    cfg: {
      cpuPerNode: 6,
      ramPerNode: 12,
      nodeCount: 3,
      loadBalancer: true,
      shards: 4,
    },
    pros: "Skaliert auch bei datenintensiven Systemen.",
    cons: "Komplexere Konsistenz, höherer Wartungsaufwand.",
    color: "#f59e0b",
  },
};

export const STRATEGY_ORDER: StrategyKey[] = [
  "baseline",
  "vertical",
  "noLB",
  "loadBalanced",
  "combined",
  "sharded",
];

/**
 * Klassifiziert eine Team-Konfiguration in eine der sechs Strategien.
 * Reihenfolge bewusst: speziellere Strategien (Sharding, Misconfig) vor
 * generelleren (Vertical, Baseline).
 */
export function classifyStrategy(cfg: TeamConfig): StrategyKey {
  if (cfg.shards > 1) return "sharded";
  if (cfg.nodeCount > 1 && !cfg.loadBalancer) return "noLB";
  if (cfg.nodeCount > 1 && cfg.loadBalancer) {
    if (cfg.cpuPerNode >= 8 || cfg.ramPerNode >= 16) return "combined";
    return "loadBalanced";
  }
  if (cfg.nodeCount === 1 && (cfg.cpuPerNode > 4 || cfg.ramPerNode > 8))
    return "vertical";
  return "baseline";
}
