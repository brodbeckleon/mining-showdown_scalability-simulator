// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE = [
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
  "#eab308",
];

export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function fmt(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return Math.round(v).toString();
}

export const STALE_AFTER_MS = 15_000;

export function isStale(lastSeen: string | number | Date): boolean {
  const ts =
    typeof lastSeen === "string"
      ? Date.parse(lastSeen)
      : new Date(lastSeen).getTime();
  return Date.now() - ts > STALE_AFTER_MS;
}
