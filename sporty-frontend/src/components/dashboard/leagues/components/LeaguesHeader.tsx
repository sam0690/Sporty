"use client";

import Link from "next/link";

type LeaguesHeaderProps = {
  userName: string;
};

export function LeaguesHeader({ userName }: LeaguesHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] pb-6">
      <div>
        <p className="section-label">Welcome back, {userName}</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-6xl">
          My Leagues
        </h1>
        <p className="mt-1 text-sm text-[#555560]">
          Your fantasy leagues at a glance
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/join-league"
          className="rounded-[3px] border border-[rgba(232,251,37,0.4)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#e8fb25] transition-colors hover:bg-[#e8fb25]/10"
        >
          Join League
        </Link>
        <Link
          href="/create-league"
          className="rounded-[3px] bg-[#e8fb25] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#0a0a0f] transition-colors hover:bg-[#f0ff45]"
        >
          Create League
        </Link>
      </div>
    </header>
  );
}
