"use client";

import { useRouter } from "next/navigation";
import { SuccessModal as SuccessModalShell } from "@/components/ui";
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

  if (!leagueData) {
    return null;
  }

  const glyph = sportGlyph(leagueData.sport);

  return (
    <SuccessModalShell
      open={isOpen}
      onClose={onClose}
      tone="success"
      eyebrow="You're in"
      title="Successfully Joined!"
      actions={[
        {
          label: "Go to League",
          variant: "primary",
          onClick: () => {
            if (leagueData.requiresTeamCreation && leagueData.id) {
              router.push(`/create-team?leagueId=${leagueData.id}`);
              return;
            }
            router.push(leagueData.id ? `/leagues/${leagueData.id}` : "/leagues");
          },
        },
        {
          label: "Set Lineup",
          variant: "secondary",
          onClick: () => {
            router.push(
              leagueData.id ? `/leagues/${leagueData.id}/lineup` : "/leagues",
            );
          },
        },
        { label: "Close", onClick: onClose, variant: "tertiary" },
      ]}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="inline-flex items-center gap-2 rounded-[3px] px-3 py-1.5"
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
      </div>
    </SuccessModalShell>
  );
}

export type { JoinedLeague };
