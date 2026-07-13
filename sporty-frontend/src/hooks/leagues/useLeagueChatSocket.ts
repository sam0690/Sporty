"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { API_PATHS } from "@/api/apiPath";
import { authApi } from "@/api/auth-api-client";
import { buildLeagueChatSocketUrl } from "@/lib/socket";
import { chatQueryKey } from "@/hooks/leagues/useLeagueChat";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

type ChatSocketEvent =
  | { event: "NEW_MESSAGE"; data: unknown }
  | { event: "MESSAGE_DELETED"; data: { id: string } }
  | { event: "REACTION_TOGGLED"; data: unknown };

/**
 * Subscribe to a league's chat channel. Rather than patch the Zustand-style
 * store the match socket uses, this just invalidates the chat query on any
 * event — chat message volume is low enough that a refetch per event is
 * cheap, and it keeps this hook simple.
 *
 * Reconnects with exponential backoff (capped at 30s), unlike the match
 * socket's fixed 2s retry — flagged during the Tier 1 pipeline audit as a
 * gap worth fixing from the start here rather than copying it forward.
 */
export function useLeagueChatSocket(leagueId: string, enabled = true) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY_MS);

  useEffect(() => {
    if (!enabled || !leagueId) {
      return;
    }

    let closedByUser = false;

    const connect = async () => {
      // Fresh ticket per connect attempt (5-min TTL) — the cookie-auth'd
      // HTTP channel vouches for the socket handshake.
      let ticket: string | undefined;
      try {
        const res = await authApi.post<{ token: string }>(API_PATHS.AUTH.WS_TICKET);
        ticket = res.data.token;
      } catch {
        // Fall through: same-origin dev sockets still carry the cookie.
      }
      if (closedByUser) {
        return;
      }
      const socket = new WebSocket(buildLeagueChatSocketUrl(leagueId, ticket));
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectDelay.current = INITIAL_RECONNECT_DELAY_MS;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ChatSocketEvent;
          if (
            message.event === "NEW_MESSAGE" ||
            message.event === "MESSAGE_DELETED" ||
            message.event === "REACTION_TOGGLED"
          ) {
            void queryClient.invalidateQueries({ queryKey: chatQueryKey(leagueId) });
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onclose = () => {
        if (closedByUser) {
          return;
        }
        reconnectTimer.current = window.setTimeout(connect, reconnectDelay.current);
        reconnectDelay.current = Math.min(
          reconnectDelay.current * 2,
          MAX_RECONNECT_DELAY_MS,
        );
      };
    };

    void connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [leagueId, enabled, queryClient]);
}
