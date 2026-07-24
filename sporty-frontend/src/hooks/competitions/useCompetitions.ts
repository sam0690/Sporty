import { keepPreviousData } from "@tanstack/react-query";

import { useApiQuery } from "../api/useApiQuery";
import { CompetitionService } from "@/services/CompetitionService";
import type {
  TCompetitionMatchesResponse,
  TCompetitionsIndex,
  TScorersResponse,
  TStandingsResponse,
} from "@/types/competition";

// Snapshots change at most daily (backend caches them), so these are cheap to
// cache long and keep the previous view while switching competition/season.
const SLOW = { staleTime: 5 * 60_000, placeholderData: keepPreviousData } as const;

export const useCompetitionsIndex = () =>
  useApiQuery<TCompetitionsIndex>(
    ["competitions", "index"],
    () => CompetitionService.list(),
    { staleTime: 60 * 60_000 },
  );

export const useCompetitionStandings = (tag: string, season?: number) =>
  useApiQuery<TStandingsResponse>(
    ["competitions", tag, "standings", season ?? "current"],
    () => CompetitionService.standings(tag, season),
    { ...SLOW, enabled: Boolean(tag) },
  );

export const useCompetitionScorers = (tag: string, season?: number) =>
  useApiQuery<TScorersResponse>(
    ["competitions", tag, "scorers", season ?? "current"],
    () => CompetitionService.scorers(tag, season),
    { ...SLOW, enabled: Boolean(tag) },
  );

export const useCompetitionMatches = (tag: string, season?: number) =>
  useApiQuery<TCompetitionMatchesResponse>(
    ["competitions", tag, "matches", season ?? "current"],
    () => CompetitionService.matches(tag, season),
    { ...SLOW, enabled: Boolean(tag) },
  );
