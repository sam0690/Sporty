"use client";

import { useRouter } from "next/navigation";
import { InviteCodeDisplay } from "@/components/dashboard/create-league/components/InviteCodeDisplay";
import { toastifier } from "@/lib/toastifier";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 ">
      <div className="animate-fade-in-scale w-full max-w-md rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6 text-center  ">
        <div className="text-4xl" aria-hidden="true">
          🎉
        </div>
        <h2 className="mt-3 text-xl font-600 text-[#f0f0f0]">
          League Created!
        </h2>
        <p className="mt-2 text-[#e8fb25]">{leagueName}</p>

        {isPrivate ? (
          <div className="mt-5 space-y-2 text-left">
            <p className="text-xs uppercase tracking-widest text-[#555560]">
              Invite Code
            </p>
            <InviteCodeDisplay inviteCode={inviteCode} />
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}`)}
            className="w-full rounded-[3px] bg-linear-to-r [#e8fb25] px-6 py-2 font-600 text-background  hover:brightness-110"
          >
            Go to League
          </button>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-6 py-2 font-600 text-[#f0f0f0] hover:border-[rgba(232,251,37,0.3)] hover:bg-[#1d1d26]"
          >
            Invite Friends
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-6 py-2 text-sm text-[#f0f0f0] hover:border-[rgba(232,251,37,0.2)] hover:text-[#f0f0f0]"
          >
            Create Another League
          </button>
        </div>
      </div>
    </div>
  );
}
