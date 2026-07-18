"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import { buildFeedItems, isShootoutEvent, type FeedItem } from "@/lib/matchPhase";
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

  // Feeder detail refinements: penalty goals, injury severity, injury subs.
  const extra = event.extra ?? {};
  let displayLabel = label;
  if (event.type === "goal" && extra.penalty === true) {
    displayLabel = "Goal (Penalty)";
  } else if (event.type === "injury") {
    displayLabel =
      extra.severity === "forced_off" ? "Injury · Forced Off" : "Injury · Knock";
  } else if (event.type === "substitution" && extra.reason === "injury") {
    displayLabel = "Substitution · Injury";
  }

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

      <span className="w-8 shrink-0 pt-1.5 text-right font-display text-lg leading-none tracking-[-0.02em] tabular-nums text-fg-2">
        {/* Shootout kicks have a synthetic minute — blank gutter, not "121'". */}
        {isShootoutEvent(event)
          ? null
          : event.minute != null
            ? `${event.minute}'`
            : "—"}
      </span>

      <span
        className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border"
        style={{
          color,
          borderColor: `${color}59`,
          background: `${color}17`,
        }}
      >
        <Icon className="size-[1.05rem]" />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
          {displayLabel}
        </div>
        <div className="mt-0.5 truncate text-xs text-fg-3">
          {event.type === "substitution" ? (
            <span className="text-fg-2">
              {event.player_name ?? "Unknown player"}
              {" on for "}
              {event.related_player_name ?? "Unknown player"}
            </span>
          ) : (
            <span className="text-fg-2">
              {event.player_name ?? "Unknown player"}
            </span>
          )}
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

const DIVIDER_TONE: Record<
  Extract<FeedItem, { kind: "divider" }>["tone"],
  string
> = {
  gold: "text-accent",
  bright: "text-fg-1",
  dim: "text-fg-2",
};

/** Phase boundary in the timeline — a centred broadcast-style rule with the
 *  phase name, breaking the spine between regulation, ET and the shootout. */
function PhaseDivider({
  item,
  index,
}: {
  item: Extract<FeedItem, { kind: "divider" }>;
  index: number;
}) {
  return (
    <li
      className="pop-in flex items-center gap-3 pb-5"
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
    >
      <span
        aria-hidden
        className="h-px min-w-4 flex-1"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.14))",
        }}
      />
      <span
        className={`font-sans text-[10px] font-700 uppercase tracking-[2px] ${DIVIDER_TONE[item.tone]}`}
      >
        {item.label}
      </span>
      {item.detail && (
        <span className="font-sans text-[10px] font-700 uppercase tracking-[1px] tabular-nums text-fg-3">
          {item.detail}
        </span>
      )}
      <span
        aria-hidden
        className="h-px min-w-4 flex-1"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.14), transparent)",
        }}
      />
    </li>
  );
}

export function EventFeed() {
  const events = useMatchStore((s) => s.events);
  const shootout = useMatchStore((s) => s.shootout);

  // Most recent first for a live ticker feel, with phase dividers (shootout /
  // extra time / full-time boundary) inserted once the match crosses 90'.
  const items = useMemo(
    () => buildFeedItems(events, shootout),
    [events, shootout],
  );

  return (
    <Panel
      title="Match Events"
      icon={<ListIcon className="size-3.5" />}
      action={
        events.length > 0 ? (
          <span className="rounded-[3px] bg-white/6 px-2 py-0.5 font-sans text-[11px] font-700 tabular-nums text-fg-2">
            {events.length}
          </span>
        ) : null
      }
      // Header stays put; only the event list scrolls once it outgrows the
      // panel, instead of stretching the whole page.
      bodyClassName="max-h-[560px] overflow-y-auto p-5"
    >
      {events.length === 0 ? (
        <PanelEmpty
          icon={<ClockIcon className="size-5" />}
          title="No events yet"
          hint="Goals, cards and assists will stream here live."
        />
      ) : (
        <ul>
          {items.map((item, idx) =>
            item.kind === "divider" ? (
              <PhaseDivider key={item.id} item={item} index={idx} />
            ) : (
              <EventRow
                key={item.event.event_id}
                event={item.event}
                // Spine only continues into the next row when it's an event —
                // it breaks at phase dividers and at the end of the feed.
                last={items[idx + 1]?.kind !== "event"}
                index={idx}
              />
            ),
          )}
        </ul>
      )}
    </Panel>
  );
}
