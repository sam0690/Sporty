"use client";

import Link from "next/link";
import { Users } from "lucide-react";

type EmptyStateProps = Record<string, never>;

export function EmptyState(_: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 text-gray-400">
        <Users className="h-5 w-5" />
      </div>
      <p className="text-lg font-medium text-gray-500">No players yet</p>
      <p className="mt-2 text-sm text-gray-400">Join a league and add players to your team</p>
      <Link
        href="/transfers"
        className="mt-6 inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
      >
        Browse Transfers
      </Link>
    </section>
  );
}
