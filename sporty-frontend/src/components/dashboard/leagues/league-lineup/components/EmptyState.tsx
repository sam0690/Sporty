"use client";

import Link from "next/link";

type EmptyStateProps = {
  leagueId: string;
};

export function EmptyState({ leagueId }: EmptyStateProps) {
  return (
    <section className="rounded-[3px] border border-white/8 bg-surface-3 py-12 text-center ">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">
        🛡️
      </div>
      <h2 className="text-xl font-600 text-fg-1">
        You don&apos;t have any players in this league yet
      </h2>
      <p className="mt-2 text-fg-3">
        Join a league or make transfers to add players
      </p>
      <p className="mt-1 text-xs text-fg-1/50">League ID: {leagueId}</p>
      <Link
        href="/transfers"
        className="mt-4 inline-flex rounded-[3px] border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
      >
        Go to Transfers
      </Link>
    </section>
  );
}
