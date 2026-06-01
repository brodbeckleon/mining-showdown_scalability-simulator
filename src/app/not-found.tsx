import { BackButton } from "@/components/BackButton";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-600 font-jb mb-4">
          404
        </div>
        <h1 className="text-5xl font-bold font-jb text-zinc-200 dark:text-zinc-800 mb-4 tabular-nums">
          NOT
          <span className="text-emerald-500 dark:text-emerald-400"> FOUND</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-jb mb-8 max-w-xs mx-auto leading-relaxed">
          This page has been replaced by the new session system. Use{" "}
          <span className="text-amber-500 dark:text-amber-400">
            Create Session
          </span>{" "}
          on the home page to get started.
        </p>
        <BackButton className="justify-center" />
      </div>
    </main>
  );
}
