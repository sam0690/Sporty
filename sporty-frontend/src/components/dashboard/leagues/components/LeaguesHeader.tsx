"use client";

import { useRouter } from "next/navigation";

type LeaguesHeaderProps = {
  userName: string;
};

export function LeaguesHeader({ userName }: LeaguesHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[rgba(11,18,32,0.08)] pb-6">
      <div>
        <p className="section-label">Welcome back, {userName}</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#0B1220] sm:text-6xl">
          My Leagues
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Your fantasy leagues at a glance
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-[3px] border border-[rgba(220,38,38,0.4)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#DC2626] transition-colors hover:bg-[#DC2626]/10"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-[3px] bg-[#DC2626] px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C]"
        >
          Create League
        </button>
      </div>
    </header>
  );
}
