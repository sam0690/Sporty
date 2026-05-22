"use client";

import Link from "next/link";

export function EmptyLeagues() {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-foreground/30" aria-hidden="true">
        🏆
      </div>
      <h3 className="font-medium text-foreground">No leagues yet</h3>
      <p className="text-sm text-foreground/60">
        Join a league to start playing
      </p>
      <Link
        href="/join-league"
        className="mt-4 inline-flex rounded-full border border-white/10 px-6 py-2 text-foreground transition-colors hover:bg-white/10"
      >
        Join League
      </Link>
    </section>
  );
}
