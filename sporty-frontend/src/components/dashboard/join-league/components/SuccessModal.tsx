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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl">
      <div className="animate-fade-in-scale w-full max-w-md rounded-4xl border border-white/10 bg-surface/90 p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div className="mb-4 text-4xl text-accent-primary" aria-hidden="true">
          ✅
        </div>
        <h2 className="text-xl font-medium text-foreground">
          Successfully Joined!
        </h2>
        <p className="mt-2 font-medium text-accent-primary">
          {leagueData.name}
        </p>
        <p className="mt-1 text-sm text-slate-400">
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
            className="w-full rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-6 py-2 font-medium text-slate-950 transition-colors hover:brightness-110"
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
            className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-2 font-semibold text-foreground transition-colors hover:bg-white/8"
          >
            Set Lineup
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/8"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export type { JoinedLeague };
