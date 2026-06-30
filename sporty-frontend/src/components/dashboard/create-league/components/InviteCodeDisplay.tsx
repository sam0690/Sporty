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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] p-3">
      <span className="font-bebas text-2xl tracking-[4px] text-[#e8fb25]">
        {inviteCode}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors hover:border-[rgba(232,251,37,0.3)] hover:text-[#f0f0f0]"
      >
        <Copy size={13} />
        Copy
      </button>
    </div>
  );
}
