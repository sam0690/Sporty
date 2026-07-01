"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export function EmptyLeagues() {
  return (
    <section className="flex flex-col items-center py-16 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <Trophy className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h3 className="font-condensed text-xl font-bold uppercase tracking-[0.02em] text-ink">
        No leagues yet
      </h3>
      <p className="mt-1 text-sm text-ink-muted">Join a league to start playing</p>
      <Link
        href="/join-league"
        className="mt-5 inline-flex items-center rounded-sm bg-primary px-6 py-2.5 font-condensed text-sm font-semibold uppercase tracking-[0.06em] text-on-primary transition-colors hover:bg-primary-hover"
      >
        Join League
      </Link>
    </section>
  );
}
