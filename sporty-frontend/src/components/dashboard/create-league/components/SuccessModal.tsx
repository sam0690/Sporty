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
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
        {/* volt accent strip */}
        <div className="h-1 bg-[#DC2626]" />

        <div className="p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.12)]">
            <Check size={26} strokeWidth={3} className="text-[#DC2626]" />
          </div>

          <p className="section-label mt-4">League Created</p>
          <h2 className="mt-1 font-bebas text-4xl leading-none tracking-[2px] text-[#0B1220]">
            {leagueName}
          </h2>

          {isPrivate ? (
            <div className="mt-5 text-left">
              <p className="section-label mb-2">Invite Code</p>
              <InviteCodeDisplay inviteCode={inviteCode} />
              <p className="mt-2 text-xs text-[#6B7280]">
                Share this code or the invite link so friends can join.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-3 text-left">
              <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#6B7280]">
                Public League
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Anyone can find and join this league from the browse page.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => router.push(`/leagues/${leagueId}`)}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#DC2626] px-6 py-2.5 font-barlow-condensed text-sm font-bold uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#DC2626]"
            >
              Go to League
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-6 py-2.5 font-barlow-condensed text-sm font-bold uppercase tracking-[1.5px] text-[#0B1220] transition-colors hover:border-[rgba(220,38,38,0.3)]"
            >
              <Share2 size={15} />
              Invite Friends
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] px-6 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280] transition-colors hover:text-[#6B7280]"
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
