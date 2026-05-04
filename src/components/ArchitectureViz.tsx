"use client";

import type { TeamConfig, Metrics } from "@/lib/types";

type Props = {
  cfg: TeamConfig;
  metrics: Metrics;
};

/**
 * Live-Topologie als SVG. Zeigt Client → (LB) → Nodes → Shards.
 * Knotenfarbe spiegelt Auslastung wider, idle Nodes (ohne LB) erscheinen grau.
 */
export function ArchitectureViz({ cfg, metrics }: Props) {
  const { nodeCount, loadBalancer, shards } = cfg;
  const { cpuPercent, dbUtil } = metrics;

  const nodeColor = (idx: number): string => {
    const isActive = loadBalancer || idx === 0;
    if (!isActive) return "#3f3f46";
    if (cpuPercent >= 90) return "#ef4444";
    if (cpuPercent >= 70) return "#f59e0b";
    return "#10b981";
  };

  const shardColor = (): string => {
    if (dbUtil >= 0.9) return "#ef4444";
    if (dbUtil >= 0.7) return "#f59e0b";
    return "#10b981";
  };

  const W = 560;
  const H = 240;
  const nodeStartX = 200;
  const nodeSpacingY =
    nodeCount > 0 ? Math.min(38, (H - 50) / Math.max(1, nodeCount)) : 38;
  const totalNodeHeight = nodeCount * nodeSpacingY;
  const nodeStartY = (H - totalNodeHeight) / 2 + 5;

  const shardStartX = 420;
  const shardSpacingY =
    shards > 0 ? Math.min(38, (H - 50) / Math.max(1, shards)) : 38;
  const totalShardHeight = shards * shardSpacingY;
  const shardStartY = (H - totalShardHeight) / 2 + 5;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="System architecture"
    >
      {/* Section labels */}
      <text
        x={50}
        y={20}
        fill="#52525b"
        fontSize="9"
        fontFamily="JetBrains Mono"
        letterSpacing="2"
      >
        CLIENT
      </text>
      <text
        x={nodeStartX + 40}
        y={20}
        textAnchor="middle"
        fill="#52525b"
        fontSize="9"
        fontFamily="JetBrains Mono"
        letterSpacing="2"
      >
        APP-TIER
      </text>
      <text
        x={shardStartX + 40}
        y={20}
        textAnchor="middle"
        fill="#52525b"
        fontSize="9"
        fontFamily="JetBrains Mono"
        letterSpacing="2"
      >
        DATA-TIER
      </text>

      {/* Client */}
      <rect
        x="20"
        y={H / 2 - 18}
        width="60"
        height="36"
        fill="#18181b"
        stroke="#52525b"
        strokeWidth="1"
      />
      <text
        x="50"
        y={H / 2 + 4}
        textAnchor="middle"
        fill="#a1a1aa"
        fontSize="10"
        fontFamily="JetBrains Mono"
      >
        Clients
      </text>

      {/* Client to LB / first node */}
      {loadBalancer ? (
        <line
          x1="80"
          y1={H / 2}
          x2="140"
          y2={H / 2}
          stroke="#3f3f46"
          strokeWidth="1"
        />
      ) : (
        <line
          x1="80"
          y1={H / 2}
          x2={nodeStartX}
          y2={nodeStartY + nodeSpacingY / 2}
          stroke="#3f3f46"
          strokeWidth="1"
        />
      )}

      {/* Load Balancer */}
      {loadBalancer && (
        <>
          <rect
            x="140"
            y={H / 2 - 18}
            width="50"
            height="36"
            fill="#18181b"
            stroke="#10b981"
            strokeWidth="1"
          />
          <text
            x="165"
            y={H / 2 - 2}
            textAnchor="middle"
            fill="#10b981"
            fontSize="9"
            fontFamily="JetBrains Mono"
          >
            LB
          </text>
          <text
            x="165"
            y={H / 2 + 9}
            textAnchor="middle"
            fill="#71717a"
            fontSize="7"
            fontFamily="JetBrains Mono"
          >
            round-robin
          </text>
        </>
      )}

      {/* Nodes */}
      {Array.from({ length: nodeCount }).map((_, i) => {
        const y = nodeStartY + i * nodeSpacingY;
        const isActive = loadBalancer || i === 0;
        const rectH = Math.min(28, nodeSpacingY - 6);
        return (
          <g key={`node-${i}`}>
            {loadBalancer && (
              <line
                x1="190"
                y1={H / 2}
                x2={nodeStartX}
                y2={y + rectH / 2}
                stroke={isActive ? "#3f3f46" : "#27272a"}
                strokeWidth="1"
              />
            )}
            <rect
              x={nodeStartX}
              y={y}
              width="80"
              height={rectH}
              fill="#0a0a0a"
              stroke={nodeColor(i)}
              strokeWidth="1"
              opacity={isActive ? 1 : 0.4}
            />
            <text
              x={nodeStartX + 40}
              y={y + rectH / 2 + 3}
              textAnchor="middle"
              fill={nodeColor(i)}
              fontSize="9"
              fontFamily="JetBrains Mono"
            >
              node-{i + 1}
            </text>
            {!isActive && (
              <text
                x={nodeStartX + 40}
                y={y + rectH + 9}
                textAnchor="middle"
                fill="#52525b"
                fontSize="7"
                fontFamily="JetBrains Mono"
              >
                idle
              </text>
            )}
            {isActive &&
              Array.from({ length: shards }).map((_, j) => {
                const sy =
                  shardStartY +
                  j * shardSpacingY +
                  Math.min(28, shardSpacingY - 6) / 2;
                return (
                  <line
                    key={`conn-${i}-${j}`}
                    x1={nodeStartX + 80}
                    y1={y + rectH / 2}
                    x2={shardStartX}
                    y2={sy}
                    stroke="#27272a"
                    strokeWidth="0.5"
                  />
                );
              })}
          </g>
        );
      })}

      {/* Shards */}
      {Array.from({ length: shards }).map((_, i) => {
        const y = shardStartY + i * shardSpacingY;
        const rectH = Math.min(28, shardSpacingY - 6);
        return (
          <g key={`shard-${i}`}>
            <rect
              x={shardStartX}
              y={y}
              width="80"
              height={rectH}
              fill="#0a0a0a"
              stroke={shardColor()}
              strokeWidth="1"
            />
            <text
              x={shardStartX + 40}
              y={y + rectH / 2 + 3}
              textAnchor="middle"
              fill={shardColor()}
              fontSize="9"
              fontFamily="JetBrains Mono"
            >
              shard-{i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
