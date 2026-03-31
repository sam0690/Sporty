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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3">
      <span className="font-mono text-lg tracking-wider text-gray-900">{inviteCode}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-primary-500"
      >
        Copy
      </button>
    </div>
  );
}
