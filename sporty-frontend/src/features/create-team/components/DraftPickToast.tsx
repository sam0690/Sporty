"use client";

import { useEffect, useState } from "react";
import type { TDraftEvent } from "@/types";

type DraftPickEvent = Extract<TDraftEvent, { type: "draft_pick_made" }>;

/** "X picked Y" toast for the live draft room — local component state, not
 * the global ToastAlert/matchStore (that store exists because ToastAlert is
 * mounted app-wide for live match scores; this only ever renders inside the
 * draft room). Styling borrowed from components/live/ToastAlert.tsx. */
export function DraftPickToast({ event }: { event: DraftPickEvent | null }) {
  const [shownPickNumber, setShownPickNumber] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  if (event && event.pick_number !== shownPickNumber) {
    setShownPickNumber(event.pick_number);
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [visible, shownPickNumber]);

  if (!visible || !event) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in-scale fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-[3px] border border-accent/32 bg-surface-1 px-3.5 py-2 font-sans text-xs font-700 text-fg-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent animate-live-pulse" />
      <span>
        <span className="text-accent">{event.team.name}</span>{" "}
        {event.was_auto_pick ? "was auto-picked" : "picked"}{" "}
        <span className="font-700">{event.player.name}</span>
      </span>
    </div>
  );
}
