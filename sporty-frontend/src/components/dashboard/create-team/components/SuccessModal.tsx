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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 ">
      <div className="w-full max-w-md rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6 text-center  ">
        <div className="text-4xl" aria-hidden="true">
          🏆
        </div>
        <h2 className="mt-3 text-2xl font-600 text-[#f0f0f0]">
          Team Created Successfully!
        </h2>
        <p className="mt-2 text-[#555560]">{teamName}</p>
        <p className="text-sm text-[#555560]">You're ready to start playing!</p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}`)}
            className="w-full rounded-[3px] bg-linear-to-r [#e8fb25] px-4 py-2 font-600 text-slate-950 hover:brightness-110"
          >
            Go to League
          </button>
          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}/lineup`)}
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 font-600 text-[#f0f0f0] hover:bg-[#1d1d26]"
          >
            Set Lineup
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[3px] px-4 py-2 text-[#555560] hover:bg-[#1d1d26] hover:text-[#f0f0f0]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
