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
      <span className="w-9 shrink-0 text-right font-bebas text-xl leading-none tracking-[1px] text-[#e8fb25]">
        {event.minute != null ? `${event.minute}'` : "—"}
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-base">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
          {label}
        </div>
        <div className="truncate text-xs text-[#555560]">
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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <header className="flex items-center justify-between">
        <span className="section-label">Match Events</span>
        {ordered.length > 0 && (
          <span className="text-xs font-600 text-[#555560]">
            {ordered.length}
          </span>
        )}
      </header>

      {ordered.length === 0 ? (
        <p className="mt-4 text-sm text-[#555560]">
          No events yet — they&apos;ll appear here as the match unfolds.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[rgba(255,255,255,0.06)]">
          {ordered.map((event) => (
            <EventRow key={event.event_id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}
