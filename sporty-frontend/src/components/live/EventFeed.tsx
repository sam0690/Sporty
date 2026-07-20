"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import { buildFeedItems, isShootoutEvent, type FeedItem } from "@/lib/matchPhase";
import type { MatchEvent } from "@/types/events";
import { Panel, PanelEmpty } from "./Panel";
import { ClockIcon, ListIcon, eventVisual, type EventVisual } from "./icons";

/** Feeder detail refinements folded into the base label: penalty goals, injury
 *  severity, injury-forced subs. */
function eventLabel(event: MatchEvent, base: string): string {
  const extra = event.extra ?? {};
  if (event.type === "goal" && extra.penalty === true) return "Goal · Penalty";
  if (event.type === "injury") {
    return extra.severity === "forced_off"
      ? "Injury · Forced Off"
      : "Injury · Knock";
  }
  if (event.type === "substitution" && extra.reason === "injury") {
    return "Substitution · Injury";
  }
  return base;
}

/** Circular event glyph — colour + tint come from the event type. Goals get a
 *  soft outer ring so the match's turning points read first. */
function EventGlyph({
  visual,
  emphasised,
}: {
  visual: EventVisual;
  emphasised: boolean;
}) {
  const { Icon, color } = visual;
  return (
    <span
      className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border"
      style={{
        color,
        borderColor: `${color}59`,
        background: `${color}17`,
        boxShadow: emphasised ? `0 0 0 4px ${color}12` : undefined,
      }}
    >
      <Icon className="size-[1.05rem]" />
    </span>
  );
}

/** Player / assist line under an event's label. Team is encoded by which side
 *  of the spine the row sits on, so it isn't repeated as text here. */
function EventDetail({ event }: { event: MatchEvent }) {
  if (event.type === "substitution") {
    return (
      <span className="text-fg-2">
        {event.player_name ?? "Unknown player"}
        <span className="text-fg-3"> for </span>
        {event.related_player_name ?? "Unknown player"}
      </span>
    );
  }
  return <span className="text-fg-2">{event.player_name ?? "Unknown player"}</span>;
}

function EventRow({
  event,
  homeTeam,
  awayTeam,
  last,
  index,
}: {
  event: MatchEvent;
  homeTeam: string | null;
  awayTeam: string | null;
  last: boolean;
  index: number;
}) {
  // Event → side of the spine. Team names come from the same snapshot as
  // home/away, so an exact match is expected; anything unmatched (or teamless,
  // e.g. the full-time whistle) sits centred on the spine.
  const side: "home" | "away" | "center" =
    event.team && event.team === awayTeam
      ? "away"
      : event.team && event.team === homeTeam
        ? "home"
        : "center";
  const teamColor =
    side === "away"
      ? teamIdentity(awayTeam).color
      : side === "home"
        ? teamIdentity(homeTeam).color
        : "#a0a0aa";

  const visual = eventVisual(event.type);
  const label = eventLabel(event, visual.label);
  const emphasised = event.type === "goal" || event.type === "shootout_goal";

  // Shootout kicks carry a synthetic minute (past 120') — show a dot, not "121'".
  const minute = isShootoutEvent(event)
    ? null
    : event.minute != null
      ? `${event.minute}'`
      : null;

  const node = (
    <span
      className="relative z-10 grid min-w-9 place-items-center rounded-full border bg-surface-1 px-2 py-1 font-display text-sm leading-none tracking-[-0.02em] tabular-nums text-fg-2"
      style={{ borderColor: side === "center" ? undefined : `${teamColor}40` }}
    >
      {minute ?? <span className="size-1.5 rounded-full bg-fg-3" />}
    </span>
  );

  // Running score stamped onto the goal by the feeder (extra.score_home/away) —
  // turns the timeline into a scoreboard. Absent on non-goals and older feeds.
  const score =
    emphasised &&
    typeof event.extra?.score_home === "number" &&
    typeof event.extra?.score_away === "number"
      ? `${event.extra.score_home}–${event.extra.score_away}`
      : null;

  const content = (
    <div className="min-w-0">
      <div
        className={`flex items-center gap-2 ${
          side === "home"
            ? "justify-end"
            : side === "away"
              ? "justify-start"
              : "justify-center"
        }`}
      >
        <span
          className="font-sans text-sm font-700 uppercase tracking-[0.5px]"
          style={{ color: emphasised ? visual.color : "var(--color-fg-1)" }}
        >
          {label}
        </span>
        {score && (
          <span className="rounded-[3px] bg-white/8 px-1.5 py-0.5 font-display text-xs leading-none tracking-[-0.02em] tabular-nums text-fg-1">
            {score}
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate text-xs">
        <EventDetail event={event} />
      </div>
    </div>
  );

  return (
    <li
      className="pop-in relative grid grid-cols-[1fr_3.5rem_1fr] items-start gap-3 pb-6 last:pb-0"
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
    >
      {/* Continuous centre spine — masked at each node, broken at phase
          boundaries and the feed's end (see `last`). */}
      {!last && (
        <span
          aria-hidden
          className="absolute top-9 bottom-0 left-1/2 w-px -translate-x-1/2"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
          }}
        />
      )}

      {side === "center" ? (
        <div className="col-span-3 flex flex-col items-center gap-2 text-center">
          <EventGlyph visual={visual} emphasised={emphasised} />
          {content}
        </div>
      ) : side === "home" ? (
        <>
          <div className="col-start-1 flex items-start justify-end gap-3 pt-0.5 text-right">
            {content}
            <EventGlyph visual={visual} emphasised={emphasised} />
          </div>
          <div className="col-start-2 flex justify-center pt-1">{node}</div>
        </>
      ) : (
        <>
          <div className="col-start-2 flex justify-center pt-1">{node}</div>
          <div className="col-start-3 flex items-start justify-start gap-3 pt-0.5 text-left">
            <EventGlyph visual={visual} emphasised={emphasised} />
            {content}
          </div>
        </>
      )}
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
      className="pop-in flex items-center gap-3 pb-6"
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

/** Home/away header rail sitting above the timeline, anchoring which side each
 *  branch of the spine belongs to. */
function TeamAxis({
  home,
  away,
}: {
  home: string | null;
  away: string | null;
}) {
  const homeColor = teamIdentity(home ?? "Home").color;
  const awayColor = teamIdentity(away ?? "Away").color;
  return (
    <div className="mb-5 grid grid-cols-[1fr_3.5rem_1fr] items-center gap-3">
      <div className="flex items-center justify-end gap-2 truncate text-right">
        <span className="truncate font-sans text-xs font-700 uppercase tracking-[0.5px] text-fg-1">
          {home ?? "Home"}
        </span>
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: homeColor }}
        />
      </div>
      <div aria-hidden className="mx-auto h-4 w-px bg-white/10" />
      <div className="flex items-center justify-start gap-2 truncate text-left">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: awayColor }}
        />
        <span className="truncate font-sans text-xs font-700 uppercase tracking-[0.5px] text-fg-1">
          {away ?? "Away"}
        </span>
      </div>
    </div>
  );
}

export function EventFeed() {
  const events = useMatchStore((s) => s.events);
  const shootout = useMatchStore((s) => s.shootout);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

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
        <>
          <TeamAxis home={homeTeam} away={awayTeam} />
          <ul>
            {items.map((item, idx) =>
              item.kind === "divider" ? (
                <PhaseDivider key={item.id} item={item} index={idx} />
              ) : (
                <EventRow
                  key={item.event.event_id}
                  event={item.event}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  // Spine only continues into the next row when it's an event —
                  // it breaks at phase dividers and the feed's end.
                  last={items[idx + 1]?.kind !== "event"}
                  index={idx}
                />
              ),
            )}
          </ul>
        </>
      )}
    </Panel>
  );
}
