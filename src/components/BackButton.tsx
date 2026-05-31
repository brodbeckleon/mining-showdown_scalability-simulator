"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/lib/lang-context";

export function BackButton({ className }: { className?: string }) {
  const { t } = useLang();
  return (
    <Link
      href="/"
      className={`flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-jb transition-colors ${className ?? ""}`}
    >
      <ArrowLeft size={12} />
      {t.common.back}
    </Link>
  );
}
