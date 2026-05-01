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

export function SuccessModal({
  isOpen,
  onClose,
  leagueId,
  leagueName,
  inviteCode,
  isPrivate,
}: SuccessModalProps) {
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
      <div className="animate-fade-in-scale w-full max-w-md rounded-lg bg-white p-6 text-center shadow-strong">
        <div className="text-4xl" aria-hidden="true">
          🎉
        </div>
        <h2 className="mt-3 text-xl font-medium text-black">
          League Created!
        </h2>
        <p className="mt-2 font-medium text-primary">{leagueName}</p>

        {isPrivate ? (
          <div className="mt-5 space-y-2 text-left">
            <p className="text-xs font-medium uppercase tracking-widest text-secondary">
              Invite Code
            </p>
            <InviteCodeDisplay inviteCode={inviteCode} />
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}`)}
            className="w-full rounded-full bg-primary px-6 py-2 font-semibold !text-white shadow-sm hover:bg-primary-700"
          >
            Go to League
          </button>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full rounded-full border border-border bg-white px-6 py-2 font-semibold text-black hover:border-primary-500"
          >
            Invite Friends
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-border bg-white px-6 py-2 text-sm font-medium text-black hover:border-primary-500 hover:text-primary"
          >
            Create Another League
          </button>
        </div>
      </div>
    </div>
  );
}
