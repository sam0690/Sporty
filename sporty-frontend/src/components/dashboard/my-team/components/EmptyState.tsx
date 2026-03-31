"use client";

import Link from "next/link";
import type { Sport } from "@/components/dashboard/my-team/components/PlayerCard";

type EmptyStateProps = {
  sport?: Sport;
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

export function EmptyState({ sport }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-border bg-surface-100 py-12 text-center shadow-card">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">
        {sport ? sportIcons[sport] : "🏟️"}
      </div>
      <p className="text-text-secondary">You haven't added any players yet</p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
      >
        Join a League
      </Link>
    </section>
  );
}
