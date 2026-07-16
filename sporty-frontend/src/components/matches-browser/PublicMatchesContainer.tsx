"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useMatches } from "@/hooks/matches/useMatches";
import { MatchService } from "@/services/MatchService";
import { MatchesBrowser } from "./MatchesBrowser";
import { shiftDateKey, toDateKey } from "./MatchDateStrip";

// The single fixtures browser (public + authenticated — /matches redirects
// here). Date defaults to today; the strip navigates day by day.

// Must build the exact filter shape useMatches receives — the query key is
// JSON.stringify(filters), so property order matters for prefetch cache hits.
function makeFilters(sport: string, date: string) {
  return {
    sport_name: sport === "all" ? undefined : sport,
    date,
    limit: 40,
  };
}

export function PublicMatchesContainer() {
  const [sport, setSport] = useState<string>("all");
  const [date, setDate] = useState<string>(() => toDateKey(new Date()));
  const queryClient = useQueryClient();

  const filters = makeFilters(sport, date);
  const { data, isLoading, isError, isPlaceholderData } = useMatches(filters);
  const items = useMemo(() => data?.items ?? [], [data]);

  // Prefetch the adjacent days so date-strip taps render instantly.
  useEffect(() => {
    for (const delta of [-1, 1]) {
      const nearby = makeFilters(sport, shiftDateKey(date, delta));
      void queryClient.prefetchQuery({
        queryKey: ["matches", "list", JSON.stringify(nearby)],
        queryFn: () => MatchService.getMatches(nearby),
        staleTime: 30_000,
      });
    }
  }, [sport, date, queryClient]);

  return (
    <MatchesBrowser
      items={items}
      isLoading={isLoading}
      isError={isError}
      isSwitching={isPlaceholderData}
      sport={sport}
      onSportChange={setSport}
      date={date}
      onDateChange={setDate}
    />
  );
}
