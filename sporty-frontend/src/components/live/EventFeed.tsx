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
    <li className="flex items-center gap-3 py-2">
      <span className="w-10 shrink-0 text-right font-bebas text-lg text-[#e8fb25]">
        {event.minute != null ? `${event.minute}'` : "—"}
      </span>
      <span className="text-lg leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-600 text-[#f0f0f0]">{label}</div>
        <div className="truncate text-xs text-[#8a8a96]">
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
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4">
      <div className="text-xs uppercase tracking-wider text-[#555560]">
        Match Events
      </div>
      {ordered.length === 0 ? (
        <p className="mt-3 text-sm text-[#555560]">No events yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[rgba(255,255,255,0.06)]">
          {ordered.map((event) => (
            <EventRow key={event.event_id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}
