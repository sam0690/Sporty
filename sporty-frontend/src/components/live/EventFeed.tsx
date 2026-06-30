"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";
import type { MatchEvent } from "@/types/events";

// Icon + readable label for known feeder event types; unknowns fall back to a
// title-cased version of the raw type so the feed degrades gracefully.
const EVENT_META: Record<string, { icon: string; label: string }> = {
  goal: { icon: "⚽", label: "Goal" },
  assist: { icon: "🅰️", label: "Assist" },
  yellow_card: { icon: "🟨", label: "Yellow Card" },
  red_card: { icon: "🟥", label: "Red Card" },
  substitution: { icon: "🔁", label: "Substitution" },
  penalty: { icon: "🎯", label: "Penalty" },
  own_goal: { icon: "🥅", label: "Own Goal" },
  clean_sheet: { icon: "🧤", label: "Clean Sheet" },
};

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function eventMeta(type: string): { icon: string; label: string } {
  return EVENT_META[type.toLowerCase()] ?? { icon: "•", label: titleCase(type) };
}

function EventRow({ event }: { event: MatchEvent }) {
  const { icon, label } = eventMeta(event.type);
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="w-9 shrink-0 text-right font-display text-base font-900 tabular-nums text-football">
        {event.minute != null ? `${event.minute}'` : "—"}
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-white/5 text-base">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-600 text-foreground">{label}</div>
        <div className="truncate text-xs text-muted-foreground">
          {event.player_name ?? event.player_id ?? "Unknown player"}
          {event.team ? ` · ${event.team}` : ""}
        </div>
      </div>
    </li>
  );
}

export function EventFeed() {
  const events = useMatchStore((s) => s.events);

  // Most recent first for a live ticker feel; minute is the primary sort key.
  const ordered = useMemo(
    () => [...events].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0)),
    [events],
  );

  return (
    <section className="glass rounded-xl p-5">
      <header className="flex items-center justify-between">
        <span className="section-label">Match Events</span>
        {ordered.length > 0 && (
          <span className="text-xs font-600 text-muted-foreground">
            {ordered.length}
          </span>
        )}
      </header>

      {ordered.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No events yet — they’ll appear here as the match unfolds.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {ordered.map((event) => (
            <EventRow key={event.event_id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}
