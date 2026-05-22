"use client";

import Image from "next/image";

type TransfersHeaderProps = {
  budget: number;
  leagueName: string;
  currentWeek: number;
};

export function TransfersHeader({
  budget,
  leagueName,
  currentWeek,
}: TransfersHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-surface/75 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 opacity-18">
        <Image
          src="/images/leagues/multisport-card.svg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
        />
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[0.04em] text-foreground uppercase">
            Transfers
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Add and drop players to build your dream team
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {leagueName} - Week {currentWeek}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-4 py-2 text-sm font-semibold text-foreground">
          <span aria-hidden="true">💰</span>
          <span>${budget.toFixed(1)} remaining</span>
        </div>
      </div>
    </header>
  );
}
