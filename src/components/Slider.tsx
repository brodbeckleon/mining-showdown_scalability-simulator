"use client";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  hint?: string;
  disabled?: boolean;
};

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  hint,
  disabled,
}: Props) {
  return (
    <div className={`space-y-1.5 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-jb">
          {label}
        </span>
        <span className="text-sm text-emerald-500 dark:text-emerald-400 font-jb tabular-nums">
          {value}
          {unit && <span className="text-zinc-500 ml-1">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 appearance-none cursor-pointer accent-emerald-500"
      />
      {hint && (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-600 leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}
