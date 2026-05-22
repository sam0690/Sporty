"use client";

import Link from "next/link";

type EmptyStateProps = {
  leagueId: string;
};

export function EmptyState({ leagueId }: EmptyStateProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 py-12 text-center backdrop-blur-xl">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">
        🛡️
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        You don&apos;t have any players in this league yet
      </h2>
      <p className="mt-2 text-foreground/60">
        Join a league or make transfers to add players
      </p>
      <p className="mt-1 text-xs text-foreground/50">League ID: {leagueId}</p>
      <Link
        href="/transfers"
        className="mt-4 inline-flex rounded-full border border-accent-primary/30 bg-accent-primary/10 px-4 py-2 text-sm font-medium text-accent-primary transition-colors hover:bg-accent-primary/15"
      >
        Go to Transfers
      </Link>
    </section>
  );
}
