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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="animate-fade-in-scale w-full max-w-md rounded-lg bg-white p-6 text-center shadow-strong">
        <div className="mb-4 text-4xl text-primary" aria-hidden="true">
          ✅
        </div>
        <h2 className="text-xl font-medium text-black">
          Successfully Joined!
        </h2>
        <p className="mt-2 font-medium text-primary">{leagueData.name}</p>
        <p className="mt-1 text-sm text-secondary">
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
            className="w-full rounded-full bg-primary px-6 py-2 font-medium text-white transition-colors hover:bg-primary-700"
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
            className="w-full rounded-full border border-border bg-white px-6 py-2 font-semibold text-black transition-colors hover:border-primary-500"
          >
            Set Lineup
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-border bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:border-primary-500 hover:text-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export type { JoinedLeague };
