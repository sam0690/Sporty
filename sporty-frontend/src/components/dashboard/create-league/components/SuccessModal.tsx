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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="animate-fade-in-scale w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="text-4xl" aria-hidden="true">
          🎉
        </div>
        <h2 className="mt-3 text-xl font-medium text-gray-900">League Created!</h2>
        <p className="mt-2 font-medium text-primary-600">{leagueName}</p>

        {isPrivate ? (
          <div className="mt-5 space-y-2 text-left">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Invite Code</p>
            <InviteCodeDisplay inviteCode={inviteCode} />
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/league/${leagueId}`)}
            className="w-full rounded-full bg-primary-600 px-6 py-2 font-semibold !text-white shadow-sm hover:bg-primary-700"
          >
            Go to League
          </button>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full rounded-full border border-gray-300 bg-white px-6 py-2 font-semibold text-gray-800 hover:border-primary-500"
          >
            Invite Friends
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:border-primary-500 hover:text-primary-600"
          >
            Create Another League
          </button>
        </div>
      </div>
    </div>
  );
}
