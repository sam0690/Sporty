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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 p-3">
      <span className="font-mono text-lg tracking-wider text-foreground">
        {inviteCode}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
      >
        Copy
      </button>
    </div>
  );
}
