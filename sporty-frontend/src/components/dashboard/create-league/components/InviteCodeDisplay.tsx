"use client";

import { toastifier } from "@/libs/toastifier";

type InviteCodeDisplayProps = {
  inviteCode: string;
};

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toastifier.success("Invite code copied");
    } catch (error) {
      toastifier.error("Unable to copy invite code");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#F4F4F9] p-3">
      <span className="font-mono text-lg tracking-wider text-black">{inviteCode}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-black hover:border-primary-500"
      >
        Copy
      </button>
    </div>
  );
}
