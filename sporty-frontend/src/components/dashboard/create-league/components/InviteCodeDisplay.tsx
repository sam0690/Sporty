"use client";

import { toastifier } from "@/lib/toastifier";

type InviteCodeDisplayProps = {
  inviteCode: string;
};

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toastifier.success("Invite code copied");
    } catch {
      toastifier.error("Unable to copy invite code");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3">
      <span className="font-mono text-lg tracking-wider text-[#f0f0f0]">
        {inviteCode}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 text-xs text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
      >
        Copy
      </button>
    </div>
  );
}
