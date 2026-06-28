"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
} from "@/lib/storage.local";
import { lineupPositionsKey } from "@/lib/storage.keys";

/** A normalized pitch coordinate, both axes in [0, 1]. */
export type SlotCoord = { x: number; y: number };

/** Map of playerId → saved pitch coordinate. */
export type LineupPositionMap = Record<string, SlotCoord>;

type UseLineupPositionsParams = {
  leagueId: string;
  teamId: string | null | undefined;
  /** Players currently in the squad; stored entries outside this set are pruned. */
  validPlayerIds: string[];
};

function isValidCoord(value: unknown): value is SlotCoord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SlotCoord).x === "number" &&
    typeof (value as SlotCoord).y === "number"
  );
}

function parsePositions(raw: string | null): LineupPositionMap {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const result: LineupPositionMap = {};
    for (const [playerId, coord] of Object.entries(parsed)) {
      if (isValidCoord(coord)) {
        result[playerId] = { x: coord.x, y: coord.y };
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Read stored positions for a key, dropping players no longer in the squad. */
function hydrate(
  storageKey: string | null,
  validPlayerIds: string[],
): LineupPositionMap {
  if (!storageKey) {
    return {};
  }
  const stored = parsePositions(getLocalStorage(storageKey));
  const valid = new Set(validPlayerIds);
  const pruned: LineupPositionMap = {};
  for (const [playerId, coord] of Object.entries(stored)) {
    if (valid.has(playerId)) {
      pruned[playerId] = coord;
    }
  }
  return pruned;
}

/**
 * Frontend-only persistence for the lineup pitch arrangement.
 *
 * Pitch position is a personal visual preference (fantasy points don't depend
 * on coordinates), so it lives in localStorage rather than the backend. The
 * formation engine supplies defaults; these stored coordinates override them
 * per player. Returns stable callbacks for the drag-and-drop layer to record
 * placements and removals; sequential calls compose via functional updates, so
 * a swap is just two `setPosition` calls.
 */
export function useLineupPositions({
  leagueId,
  teamId,
  validPlayerIds,
}: UseLineupPositionsParams) {
  const storageKey = useMemo(
    () => (leagueId && teamId ? lineupPositionsKey(leagueId, teamId) : null),
    [leagueId, teamId],
  );

  // Stable signature of the squad so re-hydration only happens on real change.
  const validIdsSignature = useMemo(
    () => [...validPlayerIds].sort().join("|"),
    [validPlayerIds],
  );
  const syncKey = `${storageKey ?? ""}::${validIdsSignature}`;

  const [positions, setPositions] = useState<LineupPositionMap>(() =>
    hydrate(storageKey, validPlayerIds),
  );

  // Re-hydrate (and prune) when the team or squad changes — React's
  // "adjust state during render on key change" pattern, which avoids an effect.
  // localStorage is the source of truth and is kept current by the persistence
  // effect below, so this never discards in-flight edits.
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    setPositions(hydrate(storageKey, validPlayerIds));
  }

  // Persist to localStorage whenever positions change. This only syncs an
  // external system from state (no setState), which is exactly what effects
  // are for.
  useEffect(() => {
    if (!storageKey) {
      return;
    }
    if (Object.keys(positions).length === 0) {
      removeLocalStorage(storageKey);
    } else {
      setLocalStorage(storageKey, JSON.stringify(positions));
    }
  }, [positions, storageKey]);

  const setPosition = useCallback((playerId: string, coord: SlotCoord) => {
    setPositions((prev) => ({ ...prev, [playerId]: coord }));
  }, []);

  const clearPosition = useCallback((playerId: string) => {
    setPositions((prev) => {
      if (!(playerId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  }, []);

  const resetPositions = useCallback(() => {
    setPositions({});
  }, []);

  return { positions, setPosition, clearPosition, resetPositions };
}
