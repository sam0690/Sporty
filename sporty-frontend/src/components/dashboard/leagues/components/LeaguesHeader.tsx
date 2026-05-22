"use client";

import { useRouter } from "next/navigation";

type LeaguesHeaderProps = {
  userName: string;
};

export function LeaguesHeader({ userName }: LeaguesHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-[2rem] border border-white/10 bg-surface/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div>
        <p className="text-sm text-slate-400">Welcome back, {userName}</p>
        <h1 className="font-display text-3xl font-bold tracking-[0.04em] text-foreground uppercase sm:text-4xl">
          My Leagues
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Your fantasy leagues at a glance
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:-translate-y-0.5 hover:border-accent-primary/30 hover:bg-accent-primary/10 hover:text-foreground"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-full border border-accent-primary/30 bg-gradient-to-r from-accent-primary to-accent-secondary px-4 py-2 text-sm font-semibold text-background shadow-glow transition-all hover:-translate-y-0.5 hover:brightness-110"
        >
          Create League
        </button>
      </div>
    </header>
  );
}
