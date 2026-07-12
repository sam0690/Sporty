"use client";

import { useMemo, useState } from "react";

import { useMatches } from "@/hooks/matches/useMatches";
import { MatchesBrowser } from "@/components/matches-browser/MatchesBrowser";
import { toDateKey } from "@/components/matches-browser/MatchDateStrip";

export function MatchesView() {
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
      variant="dashboard"
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
