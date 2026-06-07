"use client";

import Link from "next/link";

export function EmptyLeagues() {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-[#f0f0f0]/30" aria-hidden="true">
        🏆
      </div>
      <h3 className="font-medium text-[#f0f0f0]">No leagues yet</h3>
      <p className="text-sm text-[#555560]">
        Join a league to start playing
      </p>
      <Link
        href="/join-league"
        className="mt-4 inline-flex rounded-[3px] border border-[rgba(255,255,255,0.08)] px-6 py-2 text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
      >
        Join League
      </Link>
    </section>
  );
}
