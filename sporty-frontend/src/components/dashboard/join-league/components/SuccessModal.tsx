"use client";

import { useRouter } from "next/navigation";

type JoinedLeague = {
  id: number;
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

export function SuccessModal({ isOpen, onClose, leagueData }: SuccessModalProps) {
  const router = useRouter();

  if (!isOpen || !leagueData) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-100 p-6 shadow-2xl">
        <div className="mb-4 text-3xl" aria-hidden="true">✅</div>
        <h2 className="text-2xl font-semibold text-text-primary">Successfully Joined!</h2>
        <p className="mt-2 text-sm text-text-secondary">You are now part of {leagueData.name}</p>
        <p className="mt-1 text-sm text-text-secondary">Team: {leagueData.teamName ?? "Not assigned yet"}</p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => {
              if (leagueData.requiresTeamCreation) {
                router.push(`/create-team?leagueId=${leagueData.id}`);
                return;
              }

              router.push(`/league/${leagueData.id}`);
            }}
            className="w-full rounded-lg bg-primary-500 px-4 py-2 font-semibold text-white hover:bg-primary-600"
          >
            Go to League
          </button>

          <button
            type="button"
            onClick={() => router.push(`/league/${leagueData.id}/lineup`)}
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

export type { JoinedLeague };
