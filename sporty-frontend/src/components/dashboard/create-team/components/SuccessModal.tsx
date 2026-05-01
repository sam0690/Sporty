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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-[#F4F4F9] p-6 text-center shadow-strong">
        <div className="text-4xl" aria-hidden="true">
          🏆
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-black">
          Team Created Successfully!
        </h2>
        <p className="mt-2 text-secondary">{teamName}</p>
        <p className="text-sm text-secondary">
          You're ready to start playing!
        </p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}`)}
            className="w-full rounded-lg bg-primary/100 px-4 py-2 font-semibold text-white hover:bg-primary/90"
          >
            Go to League
          </button>
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}/lineup`)}
            className="w-full rounded-lg border border-primary-500 px-4 py-2 font-semibold text-primary-500 hover:bg-primary/10"
          >
            Set Lineup
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg px-4 py-2 text-secondary hover:bg-white-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
