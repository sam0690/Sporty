"use client";

import Link from "next/link";
import { Users } from "lucide-react";

export function EmptyPlayers() {
  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] py-16 text-center">
      <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] text-[#666671]">
        <Users className="size-5" aria-hidden="true" />
      </div>
      <h3 className="font-medium text-[#f0f0f0]">No players yet</h3>
      <p className="text-sm text-[#666671]">
        Make transfers to add players to your team
      </p>
      <Link
        href="/transfers"
        className="mt-4 inline-flex rounded-[3px] border border-[rgba(255,255,255,0.1)] px-6 py-2 text-[#f0f0f0] transition-colors hover:border-[rgba(232,251,37,0.3)]"
      >
        Browse Transfers
      </Link>
    </section>
  );
}
