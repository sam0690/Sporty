"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export function EmptyLeagues() {
  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-[rgba(255,255,255,0.08)] text-[#555560]">
        <Trophy className="h-5 w-5" />
      </div>
      <h3 className="font-barlow-condensed text-lg font-700 uppercase tracking-[1px] text-[#f0f0f0]">
        No leagues yet
      </h3>
      <p className="mt-1 text-sm text-[#555560]">
        Join a league to start playing
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/join-league"
          className="rounded-[3px] bg-[#e8fb25] px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#0a0a0f] transition-colors hover:bg-[#f0ff45]"
        >
          Join League
        </Link>
        <Link
          href="/create-league"
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0]"
        >
          Create League
        </Link>
      </div>
    </section>
  );
}
