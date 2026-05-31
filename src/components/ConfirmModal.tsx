"use client";

import { useLang } from "@/lib/lang-context";

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmModal({ message, onConfirm, onCancel, danger = false }: ConfirmModalProps) {
  const { t } = useLang();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-6"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6">
        <p className="text-sm text-zinc-700 dark:text-zinc-300 font-jb leading-relaxed mb-6">
          {message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-jb border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-500 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-jb transition-colors ${
              danger
                ? "bg-red-500 hover:bg-red-400 text-white dark:text-zinc-950"
                : "bg-zinc-800 dark:bg-zinc-200 hover:bg-zinc-700 dark:hover:bg-zinc-300 text-white dark:text-zinc-900"
            }`}
          >
            {t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
