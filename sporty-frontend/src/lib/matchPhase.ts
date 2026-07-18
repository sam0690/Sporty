import type { MatchEvent, Shootout } from "@/types/events";

/** The feeder simulates exactly 90 regulation minutes (no stoppage time), so
 *  any event past 90' belongs to extra time; shootout kicks carry their own
 *  event types at a synthetic minute after 120'. */
export const REGULATION_MINUTES = 90;

export function isShootoutEvent(event: MatchEvent): boolean {
  return event.type.startsWith("shootout_");
}

// ponytail: assumes football — a basketball game five overtimes deep would
// cross minute 90 too; add `sport` to the snapshot payload if OT labelling
// ever matters.
export function isExtraTimeEvent(event: MatchEvent): boolean {
  return !isShootoutEvent(event) && (event.minute ?? 0) > REGULATION_MINUTES;
}

/** Whether the match crossed into extra time — derivable after the fact from
 *  the event timeline (works on cold snapshot loads, no feeder flag needed). */
export function wentToExtraTime(
  events: MatchEvent[],
  shootout: Shootout | null,
): boolean {
  return shootout != null || events.some(isExtraTimeEvent);
}

export type FeedItem =
  | { kind: "event"; event: MatchEvent }
  | {
      kind: "divider";
      id: string;
      label: string;
      detail: string | null;
      tone: "gold" | "bright" | "dim";
    };

/** Newest-first feed model with phase dividers: shootout kicks on top, then
 *  extra time, then a Full Time boundary above the regulation events.
 *  Dividers only appear once the match actually crossed into that phase. */
export function buildFeedItems(
  events: MatchEvent[],
  shootout: Shootout | null,
): FeedItem[] {
  const ordered = [...events].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
  const kicks = ordered.filter(isShootoutEvent);
  const extraTime = ordered.filter(isExtraTimeEvent);
  const regulation = ordered.filter(
    (e) => !isShootoutEvent(e) && !isExtraTimeEvent(e),
  );

  if (kicks.length === 0 && extraTime.length === 0) {
    return ordered.map((event) => ({ kind: "event", event }));
  }

  const items: FeedItem[] = [];
  if (kicks.length > 0) {
    items.push({
      kind: "divider",
      id: "phase-shootout",
      label: "Penalty Shootout",
      detail: shootout ? `${shootout.home}–${shootout.away}` : null,
      tone: "gold",
    });
    for (const event of kicks) items.push({ kind: "event", event });
  }
  if (extraTime.length > 0) {
    items.push({
      kind: "divider",
      id: "phase-extra-time",
      label: "Extra Time",
      detail: null,
      tone: "bright",
    });
    for (const event of extraTime) items.push({ kind: "event", event });
  }
  // Extra time only ever starts from a level score, so the boundary marker
  // can state it without recomputing the 90' score from goal events.
  items.push({
    kind: "divider",
    id: "phase-full-time",
    label: "Full Time",
    detail: "Level after 90'",
    tone: "dim",
  });
  for (const event of regulation) items.push({ kind: "event", event });
  return items;
}
