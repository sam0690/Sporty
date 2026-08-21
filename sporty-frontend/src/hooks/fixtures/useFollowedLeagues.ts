"use client";

import { useCallback, useSyncExternalStore } from "react";

import { LocalStorageKeys } from "@/lib/storage.keys";
import { getLocalStorage, setLocalStorage } from "@/lib/storage.local";

// Followed competitions (by competition name, e.g. "Premier League") persisted
// in localStorage, read through useSyncExternalStore: SSR renders the empty set
// and the stored value arrives with hydration, so there's no setState-in-effect
// cascade and no hydration mismatch. Used once at the fixtures container and
// passed down, so the rail star and the pinned-to-top ordering share one source
// of truth. Backend/UserService sync (cross-device) is a later upgrade.
const EMPTY: ReadonlySet<string> = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<string> | null = null;

function read(): ReadonlySet<string> {
  const raw = getLocalStorage(LocalStorageKeys.FOLLOWED_LEAGUES);
  if (!raw) return EMPTY;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : EMPTY;
  } catch {
    return EMPTY; // Corrupt value — start empty.
  }
}

// Module scope, not inline: React compares subscribe by identity, and
// getSnapshot must return a cached value or it re-renders forever.
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): ReadonlySet<string> {
  snapshot ??= read();
  return snapshot;
}

function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY;
}

export function useFollowedLeagues() {
  const followed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggle = useCallback((league: string) => {
    const next = new Set(getSnapshot());
    if (next.has(league)) next.delete(league);
    else next.add(league);
    snapshot = next;
    setLocalStorage(
      LocalStorageKeys.FOLLOWED_LEAGUES,
      JSON.stringify([...next]),
    );
    listeners.forEach((fn) => fn());
  }, []);

  const isFollowed = useCallback(
    (league: string) => followed.has(league),
    [followed],
  );

  return { followed, isFollowed, toggle };
}
