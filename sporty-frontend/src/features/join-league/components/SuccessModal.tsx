"use client";

import { useRouter } from "next/navigation";
import { SuccessModal as SuccessModalShell } from "@/components/ui";
import { sportGlyph } from "@/components/landing/sport-icons";

type JoinedLeague = {
  id?: string;
  /** Only known when joined via the public-leagues list, which already has
   * full league details; a blind invite-code join only gets a membership
   * back from the API, so name/sport stay unset rather than guessed. */
  name?: string;
  sport?: "football" | "basketball" | "cricket" | "multisport";
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
              router.push(`/leagues/${leagueData.id}/create-team`);
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
        {leagueData.name ? (
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
        ) : (
          <p className="text-sm text-fg-2">
            Your invite code was accepted — head to your leagues to see it.
          </p>
        )}

        {leagueData.teamName ? (
          <p className="mt-3 text-sm text-fg-2">Team: {leagueData.teamName}</p>
        ) : null}
      </div>
    </SuccessModalShell>
  );
}

export type { JoinedLeague };
