"use client";

import Link from "next/link";
import { Users } from "lucide-react";

export function EmptyState() {
  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] py-16 text-center ">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-[rgba(255,255,255,0.08)] text-[#555560]">
        <Users className="h-5 w-5" />
      </div>
      <p className="text-lg text-[#f0f0f0]">No players yet</p>
      <p className="mt-2 text-sm text-[#555560]">
        Join a league and add players to your team
      </p>
      <Link
        href="/transfers"
        className="mt-6 inline-flex items-center rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
      >
        Browse Transfers
      </Link>
    </section>
  );
}
