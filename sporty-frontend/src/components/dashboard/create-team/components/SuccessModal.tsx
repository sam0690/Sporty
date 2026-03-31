"use client";

import { useRouter } from "next/navigation";

type SuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  teamName: string;
};

export function SuccessModal({ isOpen, onClose, leagueId, teamName }: SuccessModalProps) {
  const router = useRouter();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-100 p-6 text-center shadow-2xl">
        <div className="text-4xl" aria-hidden="true">🏆</div>
        <h2 className="mt-3 text-2xl font-semibold text-text-primary">Team Created Successfully!</h2>
        <p className="mt-2 text-text-secondary">{teamName}</p>
        <p className="text-sm text-text-secondary">You're ready to start playing!</p>

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
            onClick={() => router.push(`/league/${leagueId}/lineup`)}
            className="w-full rounded-lg border border-primary-500 px-4 py-2 font-semibold text-primary-500 hover:bg-primary-50"
          >
            Set Lineup
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg px-4 py-2 text-text-secondary hover:bg-surface-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
