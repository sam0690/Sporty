"use client";

import { useRouter } from "next/navigation";
import { InviteCodeDisplay } from "@/components/dashboard/create-league/components/InviteCodeDisplay";
import { toastifier } from "@/libs/toastifier";

type SuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  leagueName: string;
  inviteCode: string;
  isPrivate: boolean;
};

export function SuccessModal({ isOpen, onClose, leagueId, leagueName, inviteCode, isPrivate }: SuccessModalProps) {
  const router = useRouter();

  if (!isOpen) {
    return null;
  }

  const handleCopyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/join-league?code=${inviteCode}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      toastifier.success("Invite link copied");
    } catch (error) {
      toastifier.error("Unable to copy invite link");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-100 p-6 text-center shadow-2xl">
        <div className="text-4xl" aria-hidden="true">
          🎉
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-text-primary">League Created!</h2>
        <p className="mt-2 text-sm text-text-secondary">{leagueName}</p>

        {isPrivate ? (
          <div className="mt-5 space-y-2 text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Invite Code</p>
            <InviteCodeDisplay inviteCode={inviteCode} />
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/league/${leagueId}`)}
            className="w-full rounded-lg bg-primary-500 px-4 py-2 font-semibold text-white hover:bg-primary-600"
          >
            Go to League
          </button>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full rounded-lg border border-primary-500 px-4 py-2 font-semibold text-primary-500 hover:bg-primary-50"
          >
            Invite Friends
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-surface-200"
          >
            Create Another League
          </button>
        </div>
      </div>
    </div>
  );
}
