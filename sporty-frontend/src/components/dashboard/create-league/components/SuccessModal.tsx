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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl">
      <div className="animate-fade-in-scale w-full max-w-md rounded-4xl border border-white/10 bg-surface/90 p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div className="text-4xl" aria-hidden="true">
          🎉
        </div>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          League Created!
        </h2>
        <p className="mt-2 font-medium text-accent-primary">{leagueName}</p>

        {isPrivate ? (
          <div className="mt-5 space-y-2 text-left">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Invite Code
            </p>
            <InviteCodeDisplay inviteCode={inviteCode} />
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}`)}
            className="w-full rounded-full bg-linear-to-r from-accent-primary via-cyan-400 to-accent-secondary px-6 py-2 font-semibold text-background shadow-[0_16px_40px_rgba(0,229,255,0.18)] hover:brightness-110"
          >
            Go to League
          </button>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-2 font-semibold text-foreground hover:border-accent-primary/30 hover:bg-white/8"
          >
            Invite Friends
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm font-medium text-slate-300 hover:border-accent-primary/20 hover:text-foreground"
          >
            Create Another League
          </button>
        </div>
      </div>
    </div>
  );
}
