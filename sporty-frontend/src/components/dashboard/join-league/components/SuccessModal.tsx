"use client";

import { useRouter } from "next/navigation";

type JoinedLeague = {
  id?: string;
  name: string;
  sport: "football" | "basketball" | "cricket" | "multisport";
  teamName?: string;
  requiresTeamCreation?: boolean;
};

type SuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  leagueData: JoinedLeague | null;
};

export function SuccessModal({
  isOpen,
  onClose,
  leagueData,
}: SuccessModalProps) {
  const router = useRouter();

  if (!isOpen || !leagueData) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 ">
      <div className="animate-fade-in-scale w-full max-w-md rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6 text-center  ">
        <div className="mb-4 text-4xl text-[#e8fb25]" aria-hidden="true">
          ✅
        </div>
        <h2 className="text-xl text-[#f0f0f0]">
          Successfully Joined!
        </h2>
        <p className="mt-2 text-[#e8fb25]">
          {leagueData.name}
        </p>
        <p className="mt-1 text-sm text-[#555560]">
          Team: {leagueData.teamName ?? "Not assigned yet"}
        </p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => {
              if (leagueData.requiresTeamCreation && leagueData.id) {
                router.push(`/create-team?leagueId=${leagueData.id}`);
                return;
              }

              if (leagueData.id) {
                router.push(`/leagues/${leagueData.id}`);
                return;
              }
              router.push(`/leagues`);
            }}
            className="w-full rounded-[3px] bg-linear-to-r [#e8fb25] px-6 py-2 text-slate-950 transition-colors hover:brightness-110"
          >
            Go to League
          </button>

          <button
            type="button"
            onClick={() => {
              if (leagueData.id) {
                router.push(`/leagues/${leagueData.id}/lineup`);
                return;
              }
              router.push(`/leagues`);
            }}
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-6 py-2 font-600 text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
          >
            Set Lineup
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-6 py-2 text-sm text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export type { JoinedLeague };
