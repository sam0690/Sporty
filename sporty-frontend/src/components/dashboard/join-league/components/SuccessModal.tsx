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
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-gradient-to-b from-[#14141b] to-[#0f0f14] p-8 text-center shadow-[0_40px_90px_-30px_rgba(0,0,0,1)]">
        {/* glowing check */}
        <div className="flex justify-center">
          <span
            className="grid size-16 place-items-center rounded-full text-[#00ff88]"
            style={{
              background: "rgba(0,255,136,0.1)",
              border: "1px solid rgba(0,255,136,0.35)",
              boxShadow: "0 0 34px rgba(0,255,136,0.25)",
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
        <h2 className="mt-2 font-bebas text-4xl tracking-[2px] text-[#f0f0f0]">
          Successfully Joined!
        </h2>

        <div
          className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            color: glyph.color,
            background: `${glyph.color}14`,
            border: `1px solid ${glyph.color}3d`,
          }}
        >
          <glyph.Icon className="size-4" />
          <span className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px]">
            {leagueData.name}
          </span>
        </div>

        <p className="mt-3 text-sm text-[#9a9aa5]">
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
            className="w-full rounded-[10px] bg-[#e8fb25] px-6 py-3 font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-[#0a0a0f] shadow-[0_10px_30px_-10px_rgba(232,251,37,0.5)] transition-colors hover:bg-[#f0ff45]"
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
            className="w-full rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-6 py-3 font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-[#f0f0f0] transition-colors hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            Set Lineup
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[10px] px-6 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:text-[#f0f0f0]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export type { JoinedLeague };
