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
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-100 p-3">
      <span className="text-sm font-semibold text-text-primary">{inviteCode}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-md border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-50"
      >
        Copy
      </button>
    </div>
  );
}
