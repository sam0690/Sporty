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
    <header className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5">
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <Image src="/images/leagues/multisport-card.svg" alt="" fill className="object-cover" sizes="100vw" />
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-gray-900">Transfers</h1>
          <p className="mt-1 text-sm text-gray-500">Add and drop players to build your dream team</p>
          <p className="mt-1 text-xs text-gray-400">{leagueName} - Week {currentWeek}</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2 text-sm text-gray-700">
          <span aria-hidden="true">💰</span>
          <span>${budget.toFixed(1)} remaining</span>
        </div>
      </div>
    </header>
  );
}
