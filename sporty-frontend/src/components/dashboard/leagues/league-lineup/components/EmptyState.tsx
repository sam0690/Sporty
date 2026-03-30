"use client";

import Link from "next/link";

type EmptyStateProps = {
  leagueId: string;
};

export function EmptyState({ leagueId }: EmptyStateProps) {
  return (
    <section className="py-12 text-center">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">🛡️</div>
      <h2 className="text-xl font-semibold text-text-primary">
        You don't have any players in this league yet
      </h2>
      <p className="mt-2 text-text-secondary">
        Join a league or make transfers to add players
      </p>
      <p className="mt-1 text-xs text-text-secondary">League ID: {leagueId}</p>
      <Link
        href="/transfers"
        className="mt-4 inline-flex rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
      >
        Go to Transfers
      </Link>
    </section>
  );
}
