"use client";

import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";

export function EmptyState() {
  const router = useRouter();

  return (
    <section className="surface flex flex-col items-center py-14 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
        aria-hidden="true"
      >
        <Trophy className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h2 className="font-condensed text-xl font-bold uppercase tracking-[0.02em] text-ink">
        No leagues yet
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Join a league to start playing</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-sm bg-primary px-5 py-2.5 font-condensed text-sm font-semibold uppercase tracking-[0.06em] text-on-primary transition-colors hover:bg-primary-hover"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-sm border-[1.5px] border-border-strong bg-surface px-5 py-2.5 font-condensed text-sm font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:border-ink hover:bg-surface-muted"
        >
          Create League
        </button>
      </div>
    </section>
  );
}
