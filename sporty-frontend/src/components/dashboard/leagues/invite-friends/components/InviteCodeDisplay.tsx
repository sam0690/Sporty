"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type InviteCodeDisplayProps = {
  inviteCode: string;
};

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <p className="text-sm text-gray-600">Invite Code</p>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="font-mono text-lg font-semibold tracking-wide text-gray-900">{inviteCode}</span>
        <CopyButton value={inviteCode} label="Invite code" />
      </div>
    </div>
  );
}
