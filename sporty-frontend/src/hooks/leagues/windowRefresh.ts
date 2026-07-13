/**
 * Window-refresh helpers shared by the transfer/lineup/roster mutation hooks.
 * (Extracted with the useLeagues.ts split — these were file-internal before.)
 */
import { type useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/utils/api-Error";

export const ACTIVE_WINDOW_QUERY_KEY = (leagueId: string) => [
  "leagues",
  leagueId,
  "active-window",
];

export const EDITABLE_WINDOW_QUERY_KEY = (leagueId: string) => [
  "leagues",
  leagueId,
  "editable-window",
];

export const shouldRefreshActiveWindow = (error: unknown) =>
  isApiError(error) && (error.statusCode === 403 || error.statusCode === 409);

// Refetches BOTH the in-progress window and the editable (next) window.
// Mutations here (lineup, transfers) are gated by the editable window on
// screen, so that one must resync too, not just "active-window" — otherwise
// a save that lands right as the gameweek boundary rolls over leaves the UI
// pointed at a now-stale window while the backend has already moved on.
export async function refreshActiveWindow(
  queryClient: ReturnType<typeof useQueryClient>,
  leagueId: string,
) {
  if (!leagueId) return;

  await Promise.all([
    queryClient.refetchQueries({
      queryKey: ACTIVE_WINDOW_QUERY_KEY(leagueId),
      exact: true,
    }),
    queryClient.refetchQueries({
      queryKey: EDITABLE_WINDOW_QUERY_KEY(leagueId),
      exact: true,
    }),
  ]);
}

