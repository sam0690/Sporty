"use client";

import Link from "next/link";
import { Users } from "lucide-react";

export function EmptyPlayers() {
  return (
    <section className="card-surface py-16 text-center">
      <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full border border-white/8 text-fg-3">
        <Users className="size-5" aria-hidden="true" />
      </div>
      <h3 className="font-medium text-fg-1">No players yet</h3>
      <p className="text-sm text-fg-3">
        Make transfers to add players to your team
      </p>
      <Link
        href="/transfers"
        className="mt-4 inline-flex rounded-[3px] border border-white/10 px-6 py-2 text-fg-1 transition-colors hover:border-accent/30"
      >
        Browse Transfers
      </Link>
    </section>
  );
}
