"use client";

import { useEffect, useRef } from "react";

import { buildMatchSocketUrl } from "@/lib/socket";
import { useMatchStore } from "@/store/matchStore";
import type {
  FantasyPointsDelta,
  LineupChange,
  ScoreUpdate,
  WSMessage,
} from "@/types/events";

export function useMatchSocket(matchId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  const applyScoreUpdate = useMatchStore((s) => s.applyScoreUpdate);
  const applyPointsDelta = useMatchStore((s) => s.applyPointsDelta);
  const applyLineupChange = useMatchStore((s) => s.applyLineupChange);

  useEffect(() => {
    let closedByUser = false;

    const connect = () => {
      const socket = new WebSocket(buildMatchSocketUrl(matchId));
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          switch (message.event) {
            case "SCORE_UPDATE":
              applyScoreUpdate(message.data as unknown as ScoreUpdate);
              break;
            case "FANTASY_POINTS_DELTA":
              applyPointsDelta(message.data as unknown as FantasyPointsDelta);
              break;
            case "LINEUP_CHANGE":
              applyLineupChange(message.data as unknown as LineupChange);
              break;
            default:
              break;
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onclose = () => {
        if (closedByUser) {
          return;
        }
        reconnectTimer.current = window.setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [matchId, applyLineupChange, applyPointsDelta, applyScoreUpdate]);
}
