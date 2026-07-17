import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useMe } from "@/hooks/auth/useMe";
import { MatchService } from "@/services/MatchService";
import type { TMatch, TMatchListResponse } from "@/types/match";

/** ~TV-latency freshness for a glanceable strip; the fixture page's WebSocket
 *  is where second-accurate updates live. */
const POLL_MS = 12_000;

/**
 * Live matches involving the user's favourite teams, polled while the
 * dashboard is open. The query never fires for users without favourites,
 * and React Query pauses the interval automatically in background tabs.
 */
export function useFavouriteLiveMatches(): { matches: TMatch[] } {
  const { data: me } = useMe();
  const hasFavourites = (me?.favourite_teams?.length ?? 0) > 0;

  const query = useApiQuery<TMatchListResponse>(
    ["matches", "live-for-favourites"],
    () => MatchService.getLiveForFavourites(),
    {
      enabled: hasFavourites,
      refetchInterval: POLL_MS,
      // A decorative strip should never surface an error state — stale data
      // just keeps showing until the next successful poll drops it.
      retry: false,
    },
  );

  // Defensive re-filter: a match that finished between polls disappears the
  // moment the endpoint stops returning it as live.
  const matches = (query.data?.items ?? []).filter((m) => m.status === "live");
  return { matches };
}
