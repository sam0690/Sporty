"use client";

import { Shirt } from "lucide-react";
import { EmptyState } from "@/components/ui";

// Shown when the selected league has no team yet — with the path to fix it.
export function EmptyTeamState({ leagueId }: { leagueId?: string }) {
  return (
    <EmptyState
      icon={Shirt}
      title="No team in this league yet"
      description="Build a squad for this league, or pick another league above."
      actions={
        leagueId
          ? [
              {
                label: "Build your squad",
                href: `/leagues/${leagueId}/create-team`,
                variant: "primary",
              },
            ]
          : []
      }
    />
  );
}
