"use client";

import Link from "next/link";

type EmptyStateProps = {
  leagueId: string;
};

export function EmptyState({ leagueId }: EmptyStateProps) {
  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] py-12 text-center ">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">
        🛡️
      </div>
      <h2 className="text-xl font-600 text-[#f0f0f0]">
        You don&apos;t have any players in this league yet
      </h2>
      <p className="mt-2 text-[#555560]">
        Join a league or make transfers to add players
      </p>
      <p className="mt-1 text-xs text-[#f0f0f0]/50">League ID: {leagueId}</p>
      <Link
        href="/transfers"
        className="mt-4 inline-flex rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-4 py-2 text-sm text-[#e8fb25] transition-colors hover:bg-[rgba(232,251,37,0.1)]"
      >
        Go to Transfers
      </Link>
    </section>
  );
}
