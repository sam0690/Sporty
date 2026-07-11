"use client";

import { Shirt } from "lucide-react";

export function EmptyTeamState() {
  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-6 py-14 text-center">
      <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] text-[#666671]">
        <Shirt className="size-5" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-600 text-[#f0f0f0]">
        You haven&apos;t created a team in this league yet.
      </h3>
      <p className="mt-2 text-sm text-[#666671]">
        Select another league or build a squad for this one when you&apos;re
        ready.
      </p>
    </section>
  );
}
