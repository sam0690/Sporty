"use client";

import Link from "next/link";
import { Users } from "lucide-react";

type EmptyStateProps = Record<string, never>;

export function EmptyState(_: EmptyStateProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 py-16 text-center backdrop-blur-xl">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-slate-400">
        <Users className="h-5 w-5" />
      </div>
      <p className="text-lg font-medium text-foreground">No players yet</p>
      <p className="mt-2 text-sm text-slate-400">
        Join a league and add players to your team
      </p>
      <Link
        href="/transfers"
        className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/8"
      >
        Browse Transfers
      </Link>
    </section>
  );
}
