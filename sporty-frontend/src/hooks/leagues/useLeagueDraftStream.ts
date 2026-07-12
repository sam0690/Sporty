"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TDraftEvent, TDraftTurn } from "@/types";

// Realtime endpoints live under /api (not /api/v1) and must hit the backend
// ORIGIN directly so the httpOnly `access_token` cookie is sent. In dev
// NEXT_PUBLIC_API_URL is a relative "/api/v1" → origin "" → the Next proxy
// (same-origin, cookie preserved). In prod it's absolute → backend origin with
// credentials. Mirrors realtimeApi.ts / socket.ts.
function deriveApiOrigin(apiBase?: string): string {
  if (!apiBase) return "";
  return apiBase.replace(/\/api\/v1\/?$/, "");
}

const API_BASE = deriveApiOrigin(process.env.NEXT_PUBLIC_API_URL);

type DraftStreamEvent = {
  type: "draft_status" | "draft_started";
  league_id: string;
  status: string | null;
};

/**
 * Subscribe to a league's draft SSE stream. Invokes `onDrafting` as soon as the
 * league reports (or transitions to) the `drafting` status — this is how every
 * member's browser follows the commissioner into the draft room without polling.
 *
 * The callback is held in a ref so passing an inline function does not tear down
 * and re-open the EventSource on every render.
 */
export function useLeagueDraftStream(
  leagueId: string,
  enabled: boolean,
  onDrafting: () => void,
): void {
  const onDraftingRef = useRef(onDrafting);
  useEffect(() => {
    onDraftingRef.current = onDrafting;
  }, [onDrafting]);

  useEffect(() => {
    if (!enabled || !leagueId) return;

    const source = new EventSource(
      `${API_BASE}/api/leagues/${leagueId}/draft/stream`,
      { withCredentials: true },
    );

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DraftStreamEvent;
        if (data.type === "draft_started" || data.status === "drafting") {
          onDraftingRef.current();
        }
      } catch {
        // Ignore malformed frames — the snapshot/heartbeat contract is simple.
      }
    };

    // EventSource auto-reconnects on transient drops; on reconnect the backend
    // re-emits the current status, so no manual retry logic is needed here.
    source.onerror = () => {};

    return () => source.close();
  }, [leagueId, enabled]);
}

/**
 * Live draft-room clock/pick feed. Sibling of useLeagueDraftStream (same
 * SSE endpoint, same channel), used INSIDE the draft room once drafting has
 * started — as opposed to the lobby hook above, which only detects the
 * lobby→room transition. The two are never mounted at the same time (lobby
 * hook's `enabled` goes false once `league.status === "drafting"`, this
 * hook's `enabled` only goes true then), so there's no double-connection.
 *
 * On draft_turn_update / draft_pick_made / draft_complete, writes the fresh
 * turn straight into the draft-turn query cache (cheaper than invalidating
 * — the SSE payload already has everything useDraftTurn would refetch) and
 * invalidates the player pool so a newly-drafted player disappears from
 * search immediately. useDraftTurn's 3s poll stays on as a fallback for any
 * missed SSE frame (dropped connection, tab was asleep, etc).
 *
 * Returns the most recent draft_pick_made event, if any, so the draft room
 * can render a "X picked Y" toast.
 */
export function useDraftRoomStream(
  leagueId: string,
  enabled: boolean,
): { lastPick: Extract<TDraftEvent, { type: "draft_pick_made" }> | null } {
  const queryClient = useQueryClient();
  const [lastPick, setLastPick] = useState<Extract<TDraftEvent, { type: "draft_pick_made" }> | null>(null);

  useEffect(() => {
    if (!enabled || !leagueId) return;

    const source = new EventSource(
      `${API_BASE}/api/leagues/${leagueId}/draft/stream`,
      { withCredentials: true },
    );

    source.onmessage = (event) => {
      let data: TDraftEvent;
      try {
        data = JSON.parse(event.data) as TDraftEvent;
      } catch {
        return;
      }

      const turnKey = ["leagues", leagueId, "draft-turn"];

      if (data.type === "draft_turn_update") {
        queryClient.setQueryData<TDraftTurn>(turnKey, (prev) => ({
          league_id: data.league_id,
          current_turn_user_id: data.current_turn_user_id,
          next_pick_number: data.next_pick_number,
          round_number: data.round_number,
          is_draft_complete: false,
          total_picks_possible: prev?.total_picks_possible ?? 0,
          pick_deadline_at: data.pick_deadline_at,
        }));
      } else if (data.type === "draft_pick_made") {
        setLastPick(data);
        queryClient.invalidateQueries({ queryKey: ["players"] });
      } else if (data.type === "draft_complete") {
        queryClient.setQueryData<TDraftTurn>(turnKey, (prev) =>
          prev ? { ...prev, is_draft_complete: true, pick_deadline_at: null } : prev,
        );
        queryClient.invalidateQueries({ queryKey: ["leagues", leagueId] });
      } else if (data.type === "draft_status" && data.pick_deadline_at !== undefined) {
        queryClient.setQueryData<TDraftTurn>(turnKey, (prev) =>
          prev ? { ...prev, pick_deadline_at: data.pick_deadline_at ?? null } : prev,
        );
      }
    };

    source.onerror = () => {};

    return () => source.close();
  }, [leagueId, enabled, queryClient]);

  return { lastPick };
}
