"use client";

export function EmptyTeamState() {
  return (
    <section className="rounded-4xl border border-white/10 bg-white/5 px-6 py-14 text-center shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <div className="mb-4 text-5xl text-foreground/30" aria-hidden="true">
        🛋️
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        You haven&apos;t created a team in this league yet.
      </h3>
      <p className="mt-2 text-sm text-slate-400">
        Select another league or build a squad for this one when you&apos;re
        ready.
      </p>
    </section>
  );
}
