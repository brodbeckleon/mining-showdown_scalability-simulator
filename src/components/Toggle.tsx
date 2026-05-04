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
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-jb">
          {label}
        </span>
        <button
          type="button"
          onClick={() => !disabled && onChange(!value)}
          disabled={disabled}
          aria-pressed={value}
          className={`relative h-5 w-10 transition-colors ${value ? "bg-emerald-500" : "bg-zinc-700"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 bg-zinc-950 transition-transform ${
              value ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {hint && <p className="text-[10px] text-zinc-600 leading-snug">{hint}</p>}
    </div>
  );
}
