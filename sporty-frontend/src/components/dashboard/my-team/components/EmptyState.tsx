"use client";

import Link from "next/link";
import { Users } from "lucide-react";

type EmptyStateProps = Record<string, never>;

export function EmptyState(_: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-accent/20 bg-white py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border text-secondary/60">
        <Users className="h-5 w-5" />
      </div>
      <p className="text-lg font-medium text-secondary">No players yet</p>
      <p className="mt-2 text-sm text-secondary/60">Join a league and add players to your team</p>
      <Link
        href="/transfers"
        className="mt-6 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:border-border hover:bg-[#F4F4F9]"
      >
        Browse Transfers
      </Link>
    </section>
  );
}
