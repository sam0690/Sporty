import { useApiQuery } from "@/hooks/api/useApiQuery";
import { LeagueActivityService } from "@/services/LeagueActivityService";
import type { TLeagueActivityEvent } from "@/types";

const activityQueryKey = (leagueId: string) => ["leagues", leagueId, "activity"];

/** First page of the league activity feed. "Load more" pages beyond this
 * call LeagueActivityService.list directly with a `before` cursor and
 * accumulate in the component — a plain manually-triggered append doesn't
 * need react-query's infinite-query machinery. */
export function useLeagueActivity(leagueId: string, enabled = true) {
  return useApiQuery<TLeagueActivityEvent[]>(
    activityQueryKey(leagueId),
    () => LeagueActivityService.list(leagueId, { limit: 50 }),
    { enabled: !!leagueId && enabled },
  );
}
