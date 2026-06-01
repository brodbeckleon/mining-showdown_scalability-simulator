// ─────────────────────────────────────────────────────────────────────────────
// Skalierungsstrategien (nach Bondi & Software Engineering at Google)
// ─────────────────────────────────────────────────────────────────────────────

import type { TeamConfig, StrategyKey } from "./types";

type BiStr = { de: string; en: string };

export type Strategy = {
  key: StrategyKey;
  label: BiStr;
  short: string;
  desc: BiStr;
  cfg: TeamConfig;
  pros: BiStr;
  cons: BiStr;
  color: string;
};

export const STRATEGIES: Record<StrategyKey, Strategy> = {
  baseline: {
    key: "baseline",
    label: { de: "Ausgangszustand", en: "Baseline" },
    short: "Baseline",
    desc: {
      de: "Eine Node, minimale Ressourcen — günstig, aber sofort Engpass bei steigender Last.",
      en: "One node, minimal resources — cheap, but immediately bottlenecked under rising load.",
    },
    cfg: {
      cpuPerNode: 2,
      ramPerNode: 4,
      nodeCount: 1,
      loadBalancer: false,
      shards: 1,
    },
    pros: { de: "Billig, einfach.", en: "Cheap, simple." },
    cons: { de: "Kein Wachstumspfad.", en: "No growth path." },
    color: "#71717a",
  },
  vertical: {
    key: "vertical",
    label: { de: "Vertical Scaling", en: "Vertical Scaling" },
    short: "Vertical",
    desc: {
      de: "Eine Node, aber mehr CPU & RAM. Hilft bis zur Hardware-Grenze.",
      en: "One node, but more CPU & RAM. Helps up to the hardware limit.",
    },
    cfg: {
      cpuPerNode: 12,
      ramPerNode: 24,
      nodeCount: 1,
      loadBalancer: false,
      shards: 1,
    },
    pros: {
      de: "Schnell zu implementieren, keine Architekturänderung.",
      en: "Fast to implement, no architectural change.",
    },
    cons: {
      de: "Single Point of Failure, irgendwann Hardware-Limit.",
      en: "Single point of failure, eventual hardware limit.",
    },
    color: "#06b6d4",
  },
  noLB: {
    key: "noLB",
    label: { de: "Mehr Nodes ohne LB", en: "More Nodes, No LB" },
    short: "Misconfig",
    desc: {
      de: "Klassischer Fehler: Nodes da, aber kein Load Balancer — die erste ackert, der Rest steht.",
      en: "Classic mistake: nodes exist but no load balancer — the first one works, the rest idle.",
    },
    cfg: {
      cpuPerNode: 4,
      ramPerNode: 8,
      nodeCount: 4,
      loadBalancer: false,
      shards: 1,
    },
    pros: { de: "—", en: "—" },
    cons: {
      de: "Geld verbrannt, Engpass bleibt.",
      en: "Money wasted, bottleneck remains.",
    },
    color: "#ef4444",
  },
  loadBalanced: {
    key: "loadBalanced",
    label: { de: "Load Balancing", en: "Load Balancing" },
    short: "Load-Balanced",
    desc: {
      de: "Mehrere Nodes hinter einem Load Balancer. Last gleichmässig verteilt.",
      en: "Multiple nodes behind a load balancer. Load evenly distributed.",
    },
    cfg: {
      cpuPerNode: 4,
      ramPerNode: 8,
      nodeCount: 4,
      loadBalancer: true,
      shards: 1,
    },
    pros: {
      de: "Horizontal skalierbar, Ausfallsicherheit.",
      en: "Horizontally scalable, fault tolerance.",
    },
    cons: {
      de: "Datenbank kann zum neuen Engpass werden.",
      en: "Database can become the new bottleneck.",
    },
    color: "#10b981",
  },
  combined: {
    key: "combined",
    label: { de: "Kombiniert", en: "Combined" },
    short: "Combined",
    desc: {
      de: "Vertical + Horizontal. Solides App-Tier — aber DB ist noch nicht entlastet.",
      en: "Vertical + Horizontal. Solid app tier — but DB is not yet relieved.",
    },
    cfg: {
      cpuPerNode: 8,
      ramPerNode: 16,
      nodeCount: 4,
      loadBalancer: true,
      shards: 1,
    },
    pros: { de: "Hohe App-Kapazität.", en: "High app capacity." },
    cons: {
      de: "Teuer; bei datenintensiver Last nicht ausreichend.",
      en: "Expensive; insufficient for data-intensive load.",
    },
    color: "#8b5cf6",
  },
  sharded: {
    key: "sharded",
    label: { de: "Mit Sharding", en: "With Sharding" },
    short: "Sharded",
    desc: {
      de: "Erweiterung: DB-Last über mehrere Shards verteilt — entlastet das Data-Tier.",
      en: "Extension: DB load distributed across multiple shards — relieves the data tier.",
    },
    cfg: {
      cpuPerNode: 6,
      ramPerNode: 12,
      nodeCount: 3,
      loadBalancer: true,
      shards: 4,
    },
    pros: {
      de: "Skaliert auch bei datenintensiven Systemen.",
      en: "Scales even for data-intensive systems.",
    },
    cons: {
      de: "Komplexere Konsistenz, höherer Wartungsaufwand.",
      en: "More complex consistency, higher maintenance overhead.",
    },
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
