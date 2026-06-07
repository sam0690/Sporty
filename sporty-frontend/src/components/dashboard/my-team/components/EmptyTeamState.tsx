"use client";

export function EmptyTeamState() {
  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-6 py-14 text-center ">
      <div className="mb-4 text-5xl text-[#f0f0f0]/30" aria-hidden="true">
        🛋️
      </div>
      <h3 className="text-lg font-600 text-[#f0f0f0]">
        You haven&apos;t created a team in this league yet.
      </h3>
      <p className="mt-2 text-sm text-[#555560]">
        Select another league or build a squad for this one when you&apos;re
        ready.
      </p>
    </section>
  );
}
