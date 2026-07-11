"use client";

import { useRouter } from "next/navigation";
import { sportGlyph } from "@/components/landing/sport-icons";

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

  const glyph = sportGlyph(leagueData.sport);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden card-surface text-center">
        {/* volt accent strip */}
        <div className="h-1 bg-accent" />
        <div className="p-8">
          <div className="flex justify-center">
            <span
              className="grid size-16 place-items-center rounded-full text-success"
              style={{
                background: "rgba(0,224,127,0.1)",
                border: "1px solid rgba(0,224,127,0.35)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-8"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
          </div>

          <span className="section-label mt-5 block">You&apos;re in</span>
          <h2 className="mt-2 font-display text-4xl tracking-[-0.02em] text-fg-1">
            Successfully Joined!
          </h2>

          <div
            className="mt-4 inline-flex items-center gap-2 rounded-[3px] px-3 py-1.5"
            style={{
              color: glyph.color,
              background: `${glyph.color}14`,
              border: `1px solid ${glyph.color}3d`,
            }}
          >
            <glyph.Icon className="size-4" />
            <span className="font-sans text-sm font-700 uppercase tracking-[0.5px]">
              {leagueData.name}
            </span>
          </div>

          <p className="mt-3 text-sm text-fg-2">
            Team: {leagueData.teamName ?? "Not assigned yet"}
          </p>

          <div className="mt-7 space-y-2.5">
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
              className="w-full rounded-[3px] bg-accent px-6 py-2.5 font-sans text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
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
              className="w-full rounded-[3px] border border-white/8 bg-surface-3 px-6 py-2.5 font-sans text-sm font-700 uppercase tracking-[1.5px] text-fg-1 transition-colors hover:border-accent/30"
            >
              Set Lineup
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[3px] px-6 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-3 transition-colors hover:text-fg-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { JoinedLeague };
