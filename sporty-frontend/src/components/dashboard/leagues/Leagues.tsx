"use client";

import { useMe } from "@/hooks/auth/useMe";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import {
  LeagueCard,
  type Sport,
} from "@/components/dashboard/leagues/components/LeagueCard";
import { LeaguesHeader } from "@/components/dashboard/leagues/components/LeaguesHeader";
import { StatsRow } from "@/components/dashboard/leagues/components/StatsRow";
import { EmptyLeagues } from "@/components/ui/empty-states";
import { LeagueCardSkeleton } from "@/components/ui/skeletons";
import { LeaguesView, useLeaguesDashboard } from "@/features/leagues";

export function Leagues() {
  const vm = useLeaguesDashboard();
  return <LeaguesView {...vm} />;
}
