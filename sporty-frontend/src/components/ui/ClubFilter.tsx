"use client";

import { useMemo } from "react";

import { Select } from "@/components/ui/Select";
import { useRealTeams } from "@/hooks/players/usePlayers";
import { ALL_CLUBS, buildClubOptions } from "@/lib/clubOptions";

type ClubFilterProps = {
  /** Club name, or ALL_CLUBS for no filter. */
  value: string;
  onChange: (value: string) => void;
  /** Scope the club list to one sport ("football" | "basketball" | …). */
  sportName?: string;
  /** Limit the options to these club names (e.g. the clubs a squad spans). */
  restrictTo?: string[];
  className?: string;
};

/**
 * The one club filter — Browse Players, the team-building market, the transfer
 * market and the transfer-out roster all render this, so club-list changes
 * only ever happen in buildClubOptions.
 *
 * Backed by useRealTeams (GET /players/teams, cached 1h), so the several
 * instances on a page share a single request.
 */
export function ClubFilter({
  value,
  onChange,
  sportName,
  restrictTo,
  className = "",
}: ClubFilterProps) {
  const { data: teams } = useRealTeams(sportName);

  const options = useMemo(
    () => buildClubOptions(teams, restrictTo),
    [teams, restrictTo],
  );

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      aria-label="Filter by club"
      className={className}
    />
  );
}

export { ALL_CLUBS };
