"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Check, Plus, Share2 } from "lucide-react";
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
    } catch {
      toastifier.error("Unable to copy invite link");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
        {/* volt accent strip */}
        <div className="h-1 bg-[#e8fb25]" />

        <div className="p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.12)]">
            <Check size={26} strokeWidth={3} className="text-[#e8fb25]" />
          </div>

          <p className="section-label mt-4">League Created</p>
          <h2 className="mt-1 font-bebas text-4xl leading-none tracking-[2px] text-[#f0f0f0]">
            {leagueName}
          </h2>

          {isPrivate ? (
            <div className="mt-5 text-left">
              <p className="section-label mb-2">Invite Code</p>
              <InviteCodeDisplay inviteCode={inviteCode} />
              <p className="mt-2 text-xs text-[#555560]">
                Share this code or the invite link so friends can join.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-3 text-left">
              <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#9a9aa5]">
                Public League
              </p>
              <p className="mt-1 text-xs text-[#555560]">
                Anyone can find and join this league from the browse page.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => router.push(`/leagues/${leagueId}`)}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#e8fb25] px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#f2ff5a]"
            >
              Go to League
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-[#f0f0f0] transition-colors hover:border-[rgba(232,251,37,0.3)]"
            >
              <Share2 size={15} />
              Invite Friends
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#555560] transition-colors hover:text-[#9a9aa5]"
            >
              <Plus size={14} />
              Create Another League
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
