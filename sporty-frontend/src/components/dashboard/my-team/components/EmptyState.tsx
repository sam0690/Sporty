"use client";

import Link from "next/link";
import { Users } from "lucide-react";

export function EmptyState() {
  return (
    <section className="rounded-[3px] border border-white/8 bg-surface-3 py-16 text-center ">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/8 text-fg-3">
        <Users className="h-5 w-5" />
      </div>
      <p className="text-lg text-fg-1">No players yet</p>
      <p className="mt-2 text-sm text-fg-3">
        Join a league and add players to your team
      </p>
      <Link
        href="/transfers"
        className="mt-6 inline-flex items-center rounded-[3px] border border-white/8 bg-surface-3 px-4 py-2 text-sm text-fg-1 transition-colors hover:bg-surface-3"
      >
        Browse Transfers
      </Link>
    </section>
  );
}
