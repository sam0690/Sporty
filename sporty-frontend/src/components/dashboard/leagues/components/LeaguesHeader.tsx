"use client";

import Link from "next/link";

type LeaguesHeaderProps = {
  userName: string;
};

export function LeaguesHeader({ userName }: LeaguesHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8 pb-6">
      <div>
        <p className="section-label">Welcome back, {userName}</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
          My Leagues
        </h1>
        <p className="mt-1 text-sm text-fg-3">
          Your fantasy leagues at a glance
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/join-league"
          className="rounded-[3px] border border-accent/40 bg-transparent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-accent transition-colors hover:bg-accent/10"
        >
          Join League
        </Link>
        <Link
          href="/create-league"
          className="rounded-[3px] bg-accent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
        >
          Create League
        </Link>
      </div>
    </header>
  );
}
