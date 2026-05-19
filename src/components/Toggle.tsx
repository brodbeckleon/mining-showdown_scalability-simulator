"use client";

type Props = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
};

export function Toggle({ label, value, onChange, hint, disabled }: Props) {
  return (
    <div className={`space-y-1.5 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-jb">
          {label}
        </span>
        <button
          type="button"
          onClick={() => !disabled && onChange(!value)}
          disabled={disabled}
          aria-pressed={value}
          className={`relative h-5 w-10 overflow-hidden transition-colors ${value ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 bg-white dark:bg-zinc-950 transition-all duration-200 ${
              value ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {hint && (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-600 leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}
