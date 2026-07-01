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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-3">
      <span className="font-bebas text-2xl tracking-[4px] text-[#DC2626]">
        {inviteCode}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-3 py-1.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280] transition-colors hover:border-[rgba(220,38,38,0.3)] hover:text-[#0B1220]"
      >
        <Copy size={13} />
        Copy
      </button>
    </div>
  );
}
