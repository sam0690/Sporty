"use client";

import { useEffect, useRef } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  useActiveWindow,
  useEditableWindow,
} from "@/hooks/leagues/useLeagues";
import type { TTransferWindow } from "@/types/league";

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

// Shared deadline-aware polling: ramps up refetching as a window's soonest
// deadline approaches, and resyncs on focus/visibility. Works for either the
// in-progress (active) window or the editable (upcoming) one.
function useSmartWindowSync(
  leagueId: string,
  windowQuery: UseQueryResult<TTransferWindow, Error>,
) {
  const { data: activeWindow, isFetching, refetch } = windowQuery;
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

  return windowQuery;
}

export function useSmartActiveWindowSync(leagueId: string) {
  const activeWindowQuery = useActiveWindow(leagueId, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return useSmartWindowSync(leagueId, activeWindowQuery);
}

// Same deadline-aware polling, but tracks the gameweek you're SETTING UP (the
// next not-yet-locked window) — used by the lineup + transfers pages.
export function useSmartEditableWindowSync(leagueId: string) {
  const editableWindowQuery = useEditableWindow(leagueId, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return useSmartWindowSync(leagueId, editableWindowQuery);
}
