"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { API_PATHS } from "@/api/apiPath";
import { authApi } from "@/api/auth-api-client";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useMe } from "@/hooks/auth/useMe";
import { buildLiveSocketUrl } from "@/lib/socket";
import { MatchService } from "@/services/MatchService";
import type { TMatch, TMatchListResponse } from "@/types/match";

const QUERY_KEY = ["matches", "live-for-favourites"];

/**
 * Live matches involving the user's favourite teams. Push-driven, not polled:
 * the backend live-sync only ingests new data every few hours, so a client
 * poll can never be fresher than that. Instead we fetch once and subscribe to
 * the global `/ws/live` bell — the sync rings it when it ingests live data,
 * and we refetch then (and only then). Idle cost is a single open socket.
 */
export function useFavouriteLiveMatches(): { matches: TMatch[] } {
  const { data: me } = useMe();
  const hasFavourites = (me?.favourite_teams?.length ?? 0) > 0;
  const queryClient = useQueryClient();

  const query = useApiQuery<TMatchListResponse>(
    QUERY_KEY,
    () => MatchService.getLiveForFavourites(),
    {
      enabled: hasFavourites,
      // A decorative strip should never surface an error state — stale data
      // just keeps showing until the next successful fetch drops it.
      retry: false,
    },
  );

  useEffect(() => {
    if (!hasFavourites) {
      return;
    }
    let closedByUser = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const connect = async () => {
      // Fresh ws-ticket per connect (5-min TTL) — the cookie-auth'd HTTP
      // channel vouches for the socket handshake. Same pattern as chat.
      let ticket: string | undefined;
      try {
        const res = await authApi.post<{ token: string }>(API_PATHS.AUTH.WS_TICKET);
        ticket = res.data.token;
      } catch {
        // Fall through: same-origin dev sockets still carry the cookie.
      }
      if (closedByUser) return;
      socket = new WebSocket(buildLiveSocketUrl(ticket));
      // Any ring means the live set changed — refetch the (Redis-cached,
      // per-user) endpoint. The bell itself carries no data.
      socket.onmessage = () =>
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      socket.onclose = () => {
        if (closedByUser) return;
        reconnectTimer = window.setTimeout(() => void connect(), 2000);
      };
    };
    void connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [hasFavourites, queryClient]);

  // Defensive re-filter: a match that finished between refetches disappears the
  // moment the endpoint stops returning it as live.
  const matches = (query.data?.items ?? []).filter((m) => m.status === "live");
  return { matches };
}
