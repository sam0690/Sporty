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
    <header className="relative overflow-hidden rounded-lg border border-accent/20 bg-white p-5">
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <Image src="/images/leagues/multisport-card.svg" alt="" fill className="object-cover" sizes="100vw" />
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Transfers</h1>
          <p className="mt-1 text-sm text-secondary">Add and drop players to build your dream team</p>
          <p className="mt-1 text-xs text-secondary/60">{leagueName} - Week {currentWeek}</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-white px-4 py-2 text-sm text-black">
          <span aria-hidden="true">💰</span>
          <span>${budget.toFixed(1)} remaining</span>
        </div>
      </div>
    </header>
  );
}
