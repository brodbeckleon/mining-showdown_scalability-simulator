"use client";

type Props = {
  percent: number;
  color: string;
  criticalAt?: number;
  goldOverflow?: boolean;
};

export function Bar({
  percent,
  color,
  criticalAt = 95,
  goldOverflow = false,
}: Props) {
  const clamped = Math.min(100, Math.max(0, percent));
  const isCritical = percent >= criticalAt;
  return (
    <div className="h-1.5 w-full bg-zinc-800 relative overflow-hidden">
      <div
        className={`h-full transition-all duration-500 ${isCritical ? "bg-red-500" : color}`}
        style={{ width: `${clamped}%` }}
      />
      {goldOverflow ? (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
      ) : percent > 100 ? (
        <div className="absolute inset-0 bg-red-500/30 animate-pulse" />
      ) : null}
    </div>
  );
}
