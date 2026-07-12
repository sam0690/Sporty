"use client";

import { useEffect, useState } from "react";

type DraftClockProps = {
  /** Absolute ISO deadline for the current pick, or null when there is none
   * yet (e.g. an in-flight draft that hasn't made a pick since this shipped
   * — see the rollout note on _advance_draft_clock). */
  deadline: string | null;
};

function secondsUntil(deadline: string): number {
  return Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 1000));
}

/** Countdown computed from an absolute deadline, re-read every tick — stays
 * correct across a backgrounded tab, no server round-trip per second. */
export function DraftClock({ deadline }: DraftClockProps) {
  const [trackedDeadline, setTrackedDeadline] = useState(deadline);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    deadline ? secondsUntil(deadline) : null,
  );

  // Reset on a new deadline during render, not inside an effect — React's
  // recommended pattern for "state derived from a changed prop" (same
  // pattern components/live/ToastAlert.tsx uses for its own reset-on-change).
  if (deadline !== trackedDeadline) {
    setTrackedDeadline(deadline);
    setSecondsLeft(deadline ? secondsUntil(deadline) : null);
  }

  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setSecondsLeft(secondsUntil(deadline)), 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (secondsLeft === null) {
    return null;
  }

  const urgent = secondsLeft <= 10;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <span
      className={`num font-display text-2xl tabular-nums ${
        urgent ? "animate-pulse text-danger" : "text-fg-1"
      }`}
      aria-live="polite"
    >
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
