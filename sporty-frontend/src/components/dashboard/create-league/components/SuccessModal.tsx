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
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden card-surface">
        {/* volt accent strip */}
        <div className="h-1 bg-accent" />

        <div className="p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-accent/30 bg-accent/12">
            <Check size={26} strokeWidth={3} className="text-accent" />
          </div>

          <p className="section-label mt-4">League Created</p>
          <h2 className="mt-1 font-display text-4xl leading-none tracking-[-0.02em] text-fg-1">
            {leagueName}
          </h2>

          {isPrivate ? (
            <div className="mt-5 text-left">
              <p className="section-label mb-2">Invite Code</p>
              <InviteCodeDisplay inviteCode={inviteCode} />
              <p className="mt-2 text-xs text-fg-3">
                Share this code or the invite link so friends can join.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-[3px] border border-white/8 bg-surface-2 px-4 py-3 text-left">
              <p className="font-sans text-sm font-700 uppercase tracking-[1px] text-fg-2">
                Public League
              </p>
              <p className="mt-1 text-xs text-fg-3">
                Anyone can find and join this league from the browse page.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => router.push(`/leagues/${leagueId}`)}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-accent px-6 py-2.5 font-sans text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
            >
              Go to League
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/8 bg-surface-3 px-6 py-2.5 font-sans text-sm font-700 uppercase tracking-[1.5px] text-fg-1 transition-colors hover:border-accent/30"
            >
              <Share2 size={15} />
              Invite Friends
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] px-6 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-3 transition-colors hover:text-fg-2"
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
