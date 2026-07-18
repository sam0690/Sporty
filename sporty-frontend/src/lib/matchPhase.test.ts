import { describe, expect, it } from "vitest";

import {
  buildFeedItems,
  isExtraTimeEvent,
  isShootoutEvent,
  wentToExtraTime,
} from "./matchPhase";
import type { MatchEvent, Shootout } from "@/types/events";

const ev = (type: string, minute: number | null): MatchEvent => ({
  event_id: `${type}-${minute}-${Math.random()}`,
  type,
  minute,
  player_id: null,
});

const shootout: Shootout = { home: 4, away: 2, winner_sporty_team_id: "t1" };

describe("phase predicates", () => {
  it("classifies minutes around the 90' boundary", () => {
    expect(isExtraTimeEvent(ev("goal", 90))).toBe(false);
    expect(isExtraTimeEvent(ev("goal", 91))).toBe(true);
    expect(isExtraTimeEvent(ev("goal", null))).toBe(false);
  });

  it("shootout kicks are never extra-time events despite minute 121", () => {
    const kick = ev("shootout_goal", 121);
    expect(isShootoutEvent(kick)).toBe(true);
    expect(isExtraTimeEvent(kick)).toBe(false);
  });

  it("derives whether the match went to extra time", () => {
    expect(wentToExtraTime([ev("goal", 44)], null)).toBe(false);
    expect(wentToExtraTime([ev("goal", 105)], null)).toBe(true);
    expect(wentToExtraTime([], shootout)).toBe(true);
  });
});

describe("buildFeedItems", () => {
  it("regulation-only matches get a flat newest-first feed, no dividers", () => {
    const items = buildFeedItems([ev("goal", 12), ev("goal", 78)], null);
    expect(items.map((i) => i.kind)).toEqual(["event", "event"]);
    expect(items[0]).toMatchObject({ event: { minute: 78 } });
  });

  it("inserts Extra Time and Full Time dividers once the match passes 90'", () => {
    const items = buildFeedItems(
      [ev("goal", 30), ev("substitution", 95), ev("goal", 111)],
      null,
    );
    expect(
      items.map((i) => (i.kind === "divider" ? i.id : i.event.minute)),
    ).toEqual([
      "phase-extra-time",
      111,
      95,
      "phase-full-time",
      30,
    ]);
  });

  it("puts the shootout block on top with the tally in its divider", () => {
    const items = buildFeedItems(
      [ev("goal", 55), ev("goal", 100), ev("shootout_goal", 121), ev("shootout_miss", 121)],
      shootout,
    );
    const dividers = items.filter((i) => i.kind === "divider");
    expect(dividers.map((d) => d.id)).toEqual([
      "phase-shootout",
      "phase-extra-time",
      "phase-full-time",
    ]);
    expect(items[0]).toMatchObject({ id: "phase-shootout", detail: "4–2" });
  });

  it("still marks Full Time when ET produced no events but a shootout ran", () => {
    const items = buildFeedItems([ev("goal", 20), ev("shootout_goal", 121)], shootout);
    const ids = items.filter((i) => i.kind === "divider").map((d) => d.id);
    expect(ids).toEqual(["phase-shootout", "phase-full-time"]);
  });
});
