"use client";

import { useEffect, useRef } from "react";

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
