"use client";

import { CopyButton } from "./CopyButton";

type InviteCodeDisplayProps = {
  inviteCode: string;
};

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  return (
    <div className="overflow-hidden rounded-[3px] border border-accent/20 bg-surface-1 animate-fade-soft">
      <div className="border-b border-white/8 px-5 py-3">
        <p className="section-label">Invite Code</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <span className="font-display text-4xl tracking-[-0.02em] text-accent sm:text-5xl">
          {inviteCode}
        </span>
        <CopyButton value={inviteCode} label="Invite code" />
      </div>
    </div>
  );
}
