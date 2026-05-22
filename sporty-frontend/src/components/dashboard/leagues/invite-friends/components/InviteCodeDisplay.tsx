"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type InviteCodeDisplayProps = {
  inviteCode: string;
};

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <p className="text-sm text-foreground/60">Invite Code</p>
      <div className="mt-2 flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-4 py-3">
        <span className="font-mono text-lg font-semibold tracking-wide text-foreground">
          {inviteCode}
        </span>
        <CopyButton value={inviteCode} label="Invite code" />
      </div>
    </div>
  );
}
