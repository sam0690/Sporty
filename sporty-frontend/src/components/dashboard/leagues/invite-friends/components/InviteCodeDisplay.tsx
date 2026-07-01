"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type InviteCodeDisplayProps = {
  inviteCode: string;
};

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  return (
    <div className="overflow-hidden rounded-[3px] border border-[rgba(220,38,38,0.2)] bg-[#FFFFFF] animate-fade-soft">
      <div className="border-b border-[rgba(11,18,32,0.08)] px-5 py-3">
        <p className="section-label">Invite Code</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <span className="font-bebas text-4xl tracking-[8px] text-[#DC2626] sm:text-5xl">
          {inviteCode}
        </span>
        <CopyButton value={inviteCode} label="Invite code" />
      </div>
    </div>
  );
}
