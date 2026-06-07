"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type InviteCodeDisplayProps = {
  inviteCode: string;
};

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  return (
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
      <p className="text-sm text-[#555560]">Invite Code</p>
      <div className="mt-2 flex items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3">
        <span className="font-mono text-lg font-600 tracking-wide text-[#f0f0f0]">
          {inviteCode}
        </span>
        <CopyButton value={inviteCode} label="Invite code" />
      </div>
    </div>
  );
}
