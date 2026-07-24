"use client";

import { useCallback, useEffect, useState } from "react";

import { LocalStorageKeys } from "@/lib/storage.keys";
import { getLocalStorage, setLocalStorage } from "@/lib/storage.local";

// Followed competitions (by competition name, e.g. "Premier League") persisted
// in localStorage. Used once at the fixtures container and passed down, so the
// rail star and the pinned-to-top ordering share one source of truth.
// Backend/UserService sync (cross-device) is a later upgrade.
export function useFollowedLeagues() {
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Load once on mount (client only; SSR renders empty then fills in).
  useEffect(() => {
    const raw = getLocalStorage(LocalStorageKeys.FOLLOWED_LEAGUES);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setFollowed(new Set(arr.map(String)));
      } catch {
        // Corrupt value — ignore and start empty.
      }
    }
    setHydrated(true);
  }, []);

  // Persist on change (after the initial load, so we never clobber with empty).
  useEffect(() => {
    if (!hydrated) return;
    setLocalStorage(
      LocalStorageKeys.FOLLOWED_LEAGUES,
      JSON.stringify([...followed]),
    );
  }, [followed, hydrated]);

  const toggle = useCallback((league: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(league)) next.delete(league);
      else next.add(league);
      return next;
    });
  }, []);

  const isFollowed = useCallback(
    (league: string) => followed.has(league),
    [followed],
  );

  return { followed, isFollowed, toggle };
}
