"use client";

import { Copy } from "lucide-react";
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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[3px] border border-white/8 bg-surface-2 p-3">
      <span className="font-display text-2xl tracking-[-0.02em] text-accent">
        {inviteCode}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-[3px] border border-white/8 bg-surface-3 px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:border-accent/30 hover:text-fg-1"
      >
        <Copy size={13} />
        Copy
      </button>
    </div>
  );
}
