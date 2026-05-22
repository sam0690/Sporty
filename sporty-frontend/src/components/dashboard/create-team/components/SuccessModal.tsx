"use client";

import { useRouter } from "next/navigation";

type SuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  teamName: string;
};

export function SuccessModal({
  isOpen,
  onClose,
  leagueId,
  teamName,
}: SuccessModalProps) {
  const router = useRouter();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-surface/90 p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div className="text-4xl" aria-hidden="true">
          🏆
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-foreground">
          Team Created Successfully!
        </h2>
        <p className="mt-2 text-slate-400">{teamName}</p>
        <p className="text-sm text-slate-400">You're ready to start playing!</p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}`)}
            className="w-full rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-4 py-2 font-semibold text-slate-950 hover:brightness-110"
          >
            Go to League
          </button>
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}/lineup`)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-foreground hover:bg-white/8"
          >
            Set Lineup
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full px-4 py-2 text-slate-400 hover:bg-white/8 hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
