"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import type { MatchEvent } from "@/types/events";
import { Panel, PanelEmpty } from "./Panel";
import { ClockIcon, ListIcon, eventVisual } from "./icons";

function EventRow({
  event,
  last,
  index,
}: {
  event: MatchEvent;
  last: boolean;
  index: number;
}) {
  const { Icon, color, label } = eventVisual(event.type);
  const teamColor = event.team ? teamIdentity(event.team).color : color;

  return (
    <li
      className="pop-in relative flex gap-4 pb-5 last:pb-0"
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
    >
      {/* timeline spine — fades out toward the end of the feed */}
      {!last && (
        <span
          aria-hidden
          className="absolute left-[1.4rem] top-11 bottom-0 w-px"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
          }}
        />
      )}

      <span className="w-8 shrink-0 pt-1.5 text-right font-bebas text-lg leading-none tracking-[1px] tabular-nums text-[#9a9aa5]">
        {event.minute != null ? `${event.minute}'` : "—"}
      </span>

      <span
        className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border"
        style={{
          color,
          borderColor: `${color}59`,
          background: `${color}17`,
          boxShadow: `0 0 14px ${color}22`,
        }}
      >
        <Icon className="size-[1.05rem]" />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-xs text-[#6a6a76]">
          <span className="text-[#9a9aa5]">
            {event.player_name ?? "Unknown player"}
          </span>
          {event.team && (
            <>
              {" · "}
              <span style={{ color: teamColor }}>{event.team}</span>
            </>
          )}
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
    <Panel
      title="Match Events"
      icon={<ListIcon className="size-3.5" />}
      action={
        ordered.length > 0 ? (
          <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-0.5 font-barlow-condensed text-[11px] font-700 tabular-nums text-[#9a9aa5]">
            {ordered.length}
          </span>
        ) : null
      }
    >
      {ordered.length === 0 ? (
        <PanelEmpty
          icon={<ClockIcon className="size-5" />}
          title="No events yet"
          hint="Goals, cards and assists will stream here live."
        />
      ) : (
        <ul>
          {ordered.map((event, idx) => (
            <EventRow
              key={event.event_id}
              event={event}
              last={idx === ordered.length - 1}
              index={idx}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
