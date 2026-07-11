"use client";

import Image from "next/image";
import { Wallet } from "lucide-react";

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
    <header className="relative overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5">
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
          <h1 className="font-bebas text-5xl tracking-[3px] text-[#f0f0f0]">
            Transfers
          </h1>
          <p className="mt-1 text-sm text-[#555560]">
            Add and drop players to build your dream team
          </p>
          <p className="mt-1 text-xs text-[#555560]">
            {leagueName} - Week {currentWeek}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-[3px] border border-[rgba(232,251,37,0.25)] bg-[rgba(232,251,37,0.08)] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#e8fb25]">
          <Wallet className="h-4 w-4" aria-hidden="true" />
          <span>${budget.toFixed(1)}M remaining</span>
        </div>
      </div>
    </header>
  );
}
