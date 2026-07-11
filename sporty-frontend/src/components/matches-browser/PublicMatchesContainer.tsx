"use client";

import { useMemo, useState } from "react";

import { usePublicMatches } from "@/hooks/matches/usePublicMatches";
import { MatchesBrowser } from "./MatchesBrowser";

export function PublicMatchesContainer() {
  const [sport, setSport] = useState<string>("all");
  const { data, isLoading, isError } = usePublicMatches({
    sport_name: sport === "all" ? undefined : sport,
    limit: 40,
  });
  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <MatchesBrowser
      variant="public"
      items={items}
      isLoading={isLoading}
      isError={isError}
      sport={sport}
      onSportChange={setSport}
    />
  );
}
