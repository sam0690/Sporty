"use client";

import Link from "next/link";
import { Users } from "lucide-react";

type EmptyStateProps = Record<string, never>;

export function EmptyState(_: EmptyStateProps) {
  return (
    <section className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] py-16 text-center ">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-[rgba(11,18,32,0.08)] text-[#6B7280]">
        <Users className="h-5 w-5" />
      </div>
      <p className="text-lg text-[#0B1220]">No players yet</p>
      <p className="mt-2 text-sm text-[#6B7280]">
        Join a league and add players to your team
      </p>
      <Link
        href="/transfers"
        className="mt-6 inline-flex items-center rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-4 py-2 text-sm text-[#0B1220] transition-colors hover:bg-[#F3F4F7]"
      >
        Browse Transfers
      </Link>
    </section>
  );
}
