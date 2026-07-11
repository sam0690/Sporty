"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export function EmptyLeagues() {
  return (
    <section className="card-surface py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/8 text-fg-3">
        <Trophy className="h-5 w-5" />
      </div>
      <h3 className="font-barlow-condensed text-lg font-700 uppercase tracking-[1px] text-fg-1">
        No leagues yet
      </h3>
      <p className="mt-1 text-sm text-fg-3">
        Join a league to start playing
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/join-league"
          className="rounded-[3px] bg-accent px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
        >
          Join League
        </Link>
        <Link
          href="/create-league"
          className="rounded-[3px] border border-white/8 px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1"
        >
          Create League
        </Link>
      </div>
    </section>
  );
}
