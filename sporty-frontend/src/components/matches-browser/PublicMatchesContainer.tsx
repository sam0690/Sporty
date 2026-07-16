"use client";

import { useMemo, useState } from "react";

import { useMatches } from "@/hooks/matches/useMatches";
import { MatchesBrowser } from "./MatchesBrowser";
import { toDateKey } from "./MatchDateStrip";

// The single fixtures browser (public + authenticated — /matches redirects
// here). Date defaults to today; the strip navigates day by day.
export function PublicMatchesContainer() {
  const [sport, setSport] = useState<string>("all");
  const [date, setDate] = useState<string>(() => toDateKey(new Date()));
  const { data, isLoading, isError } = useMatches({
    sport_name: sport === "all" ? undefined : sport,
    date,
    limit: 40,
  });
  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <MatchesBrowser
      items={items}
      isLoading={isLoading}
      isError={isError}
      sport={sport}
      onSportChange={setSport}
      date={date}
      onDateChange={setDate}
    />
  );
}
