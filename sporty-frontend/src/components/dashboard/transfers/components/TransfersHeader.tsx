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
    <header className="surface relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
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
          <p className="kicker">Squad Management</p>
          <h1 className="mt-1.5 font-condensed text-5xl font-bold uppercase leading-none tracking-[0.01em] text-ink">
            Transfers
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Add and drop players to build your dream team
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {leagueName} — Week {currentWeek}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-sm bg-primary-soft px-4 py-2.5 font-condensed text-sm font-bold uppercase tracking-[0.08em] text-primary">
          <Wallet className="h-4 w-4" aria-hidden="true" />
          <span className="num">${budget.toFixed(1)} remaining</span>
        </div>
      </div>
    </header>
  );
}
