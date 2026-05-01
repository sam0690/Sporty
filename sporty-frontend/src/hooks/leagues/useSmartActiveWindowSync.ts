"use client";

import { useEffect, useRef } from "react";
import { useActiveWindow } from "@/hooks/leagues/useLeagues";

const SMART_POLL_LOOKAHEAD_MS = 10 * 60 * 1000;
const SMART_POLL_INTERVAL_MS = 45 * 1000;

function toDeadlineMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getSoonestDeadlineMs(
  transferDeadlineAt?: string | null,
  lineupDeadlineAt?: string | null,
): number | null {
  const deadlines = [
    toDeadlineMs(transferDeadlineAt),
    toDeadlineMs(lineupDeadlineAt),
  ].filter((value): value is number => value !== null);

  if (deadlines.length === 0) {
    return null;
  }

  return Math.min(...deadlines);
}

export function useSmartActiveWindowSync(leagueId: string) {
  const activeWindowQuery = useActiveWindow(leagueId, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const { data: activeWindow, isFetching, refetch } = activeWindowQuery;
  const pendingRefetchRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    const syncActiveWindow = () => {
      if (pendingRefetchRef.current || isFetching) {
        return;
      }

      const request = refetch();
      pendingRefetchRef.current = request.finally(() => {
        pendingRefetchRef.current = null;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncActiveWindow();
      }
    };

    const handleFocus = () => {
      syncActiveWindow();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isFetching, refetch, leagueId]);

  useEffect(() => {
    const soonestDeadlineMs = getSoonestDeadlineMs(
      activeWindow?.transfer_deadline_at,
      activeWindow?.lineup_deadline_at,
    );

    if (!soonestDeadlineMs) {
      return;
    }

    const nowMs = Date.now();
    const timeUntilDeadlineMs = soonestDeadlineMs - nowMs;

    if (
      timeUntilDeadlineMs <= 0 ||
      timeUntilDeadlineMs > SMART_POLL_LOOKAHEAD_MS
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!pendingRefetchRef.current && !isFetching) {
        void refetch();
      }
    }, SMART_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeWindow?.lineup_deadline_at,
    activeWindow?.transfer_deadline_at,
    isFetching,
    refetch,
  ]);

  return activeWindowQuery;
}
