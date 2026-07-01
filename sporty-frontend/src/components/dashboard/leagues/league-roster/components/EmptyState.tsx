"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import type { Sport } from "@/components/dashboard/leagues/league-roster/components/RosterHeader";

type EmptyStateProps = {
  leagueId: string;
  sport: Sport;
};

export function EmptyState({ leagueId, sport }: EmptyStateProps) {
  return (
    <section className="surface flex flex-col items-center py-12 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <Shield className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h2 className="font-condensed text-xl font-bold uppercase tracking-[0.02em] text-ink">
        You don&apos;t have any players in this league yet
      </h2>
      <p className="mt-2 text-ink-muted">Make transfers to add players to your roster</p>
      <p className="mt-1 text-xs text-ink-faint">
        League {leagueId} • {sport}
      </p>
      <Link
        href="/transfers"
        className="mt-5 inline-flex rounded-sm bg-primary px-5 py-2.5 font-condensed text-sm font-semibold uppercase tracking-[0.06em] text-on-primary transition-colors hover:bg-primary-hover hover:no-underline"
      >
        Go to Transfers
      </Link>
    </section>
  );
}
