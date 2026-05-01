"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type InviteCodeDisplayProps = {
  inviteCode: string;
};

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  return (
    <div className="rounded-lg border border-accent/20 bg-white p-5">
      <p className="text-sm text-secondary">Invite Code</p>
      <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-[#F4F4F9] px-4 py-3">
        <span className="font-mono text-lg font-semibold tracking-wide text-black">{inviteCode}</span>
        <CopyButton value={inviteCode} label="Invite code" />
      </div>
    </div>
  );
}
