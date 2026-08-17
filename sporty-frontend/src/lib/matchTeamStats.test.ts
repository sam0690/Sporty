import { describe, expect, it } from "vitest";

import {
  buildStatLookup,
  deriveTeamTotals,
  displayValue,
  toNumber,
  visibleGroups,
} from "./matchTeamStats";
import type { MatchLineups, MatchPlayerBreakdown, PlayerInfo } from "@/types/events";

describe("toNumber", () => {
  it("reads plain numbers and percentages", () => {
    expect(toNumber(8)).toBe(8);
    expect(toNumber("62%")).toBe(62);
  });

  it("reads numeric strings — expected_goals arrives as one", () => {
    // The bug this guards: "1.41" used to return null, so every xG bar
    // collapsed to the neutral 50/50 split.
    expect(toNumber("1.41")).toBe(1.41);
    expect(toNumber("-0.57")).toBe(-0.57);
  });

  it("unwraps the {source, parsedValue} shape", () => {
    expect(toNumber({ source: "38.0", parsedValue: 38 } as never)).toBe(38);
  });

  it("keeps 'not reported' distinct from zero", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("N/A")).toBeNull();
    expect(toNumber(0)).toBe(0);
  });
});

describe("displayValue", () => {
  it("shows an em-dash for unreported stats, not 0", () => {
    expect(displayValue(null)).toBe("–");
    expect(displayValue(0)).toBe("0");
    expect(displayValue("62%")).toBe("62%");
  });
});

const lineups = {
  home: [{ player_id: "h1", name: "Home Starter" }],
  away: [{ player_id: "a1", name: "Away Starter" }],
  home_bench: [{ player_id: "h2", name: "Home Sub" }],
  away_bench: [{ player_id: "a2", name: "Away Sub" }],
} as MatchLineups;

function breakdown(stats: Record<string, number | null>): MatchPlayerBreakdown {
  return { position: "MID", points: 0, bonus: 0, rating: null, breakdown: [], stats };
}

describe("deriveTeamTotals", () => {
  it("sums the per-player sheet into team totals", () => {
    const totals = deriveTeamTotals(
      {
        h1: breakdown({ tackles: 3, interceptions: 1, duels_won: 4 }),
        h2: breakdown({ tackles: 2, interceptions: 0, duels_won: 1 }),
        a1: breakdown({ tackles: 1, interceptions: 2, duels_won: 6 }),
      },
      lineups,
      {},
      "Home FC",
      "Away FC",
    );
    expect(totals.home.tackles).toBe(5);
    expect(totals.away.tackles).toBe(1);
    expect(totals.home.duels_won).toBe(5);
    expect(totals.away.interceptions).toBe(2);
  });

  it("assigns a side from the lineup even when the stored club is wrong", () => {
    // Real case: an Elche bench player is stored under "Atletico Madrid".
    // Name-matching alone would drop them from both teams' totals.
    const players: Record<string, PlayerInfo> = {
      a2: { name: "Misfiled Sub", team: "Atletico Madrid" },
    };
    const totals = deriveTeamTotals(
      { a2: breakdown({ tackles: 4 }) },
      lineups,
      players,
      "Home FC",
      "Away FC",
    );
    expect(totals.away.tackles).toBe(4);
    expect(totals.home.tackles).toBe(0);
  });

  it("falls back to the stored club when the player is in no lineup", () => {
    const players: Record<string, PlayerInfo> = {
      x9: { name: "Unlisted", team: "Home FC" },
    };
    const totals = deriveTeamTotals(
      { x9: breakdown({ tackles: 2 }) },
      { home: [], away: [] } as MatchLineups,
      players,
      "Home FC",
      "Away FC",
    );
    expect(totals.home.tackles).toBe(2);
  });

  it("leaves a stat absent when neither side reported it", () => {
    const totals = deriveTeamTotals(
      { h1: breakdown({ tackles: 1 }) },
      lineups,
      {},
      "Home FC",
      "Away FC",
    );
    expect(totals.home.clearances).toBeUndefined();
    expect(totals.away.tackles).toBe(0); // one side has it => 0 for the other
  });

  it("suppresses a derived stat that is zero on both sides", () => {
    // The provider writes an explicit clearances: 0 for every player when it
    // doesn't cover the stat. Summing that is 0–0, which is a data gap wearing
    // a real number — it must not render as a row.
    const totals = deriveTeamTotals(
      {
        h1: breakdown({ tackles: 3, clearances: 0 }),
        a1: breakdown({ tackles: 2, clearances: 0 }),
      },
      lineups,
      {},
      "Home FC",
      "Away FC",
    );
    expect(totals.home.clearances).toBeUndefined();
    expect(totals.away.clearances).toBeUndefined();
    expect(totals.home.tackles).toBe(3);
  });
});

describe("visibleGroups", () => {
  it("keeps every stat the provider actually sent", () => {
    // The Deportivo v Elche sheet, trimmed to its keys.
    const teamStats = {
      home: {
        "Ball Possession": "38%",
        expected_goals: "0.23",
        "Total Shots": 7,
        "Shots on Goal": 3,
        "Shots off Goal": 3,
        "Blocked Shots": 1,
        "Shots insidebox": 5,
        "Shots outsidebox": 2,
        "Corner Kicks": 2,
        "Total passes": 387,
        "Passes accurate": 317,
        "Passes %": "82%",
        Fouls: 15,
        Offsides: 2,
        "Yellow Cards": 2,
        "Red Cards": null,
        "Goalkeeper Saves": 5,
      },
      away: {
        "Ball Possession": "62%",
        expected_goals: "1.41",
        "Total Shots": 11,
        "Shots on Goal": 6,
        "Shots off Goal": 2,
        "Blocked Shots": 3,
        "Shots insidebox": 7,
        "Shots outsidebox": 4,
        "Corner Kicks": 6,
        "Total passes": 637,
        "Passes accurate": 563,
        "Passes %": "88%",
        Fouls: 12,
        Offsides: 0,
        "Yellow Cards": 2,
        "Red Cards": null,
        "Goalkeeper Saves": 2,
      },
    };
    const derived = deriveTeamTotals(
      { h1: breakdown({ tackles: 3 }), a1: breakdown({ tackles: 5 }) },
      lineups,
      {},
      "Home FC",
      "Away FC",
    );
    const groups = visibleGroups(buildStatLookup(teamStats, derived));

    expect(groups.map((g) => g.title)).toEqual([
      "Top stats",
      "Shots",
      "Passes",
      "Defence",
      "Discipline",
    ]);

    const shown = new Set(groups.flatMap((g) => g.rows.map((r) => r.key)));
    for (const key of Object.keys(teamStats.home)) {
      // Red Cards is null on both sides here, so it correctly drops out.
      if (key === "Red Cards") continue;
      expect(shown.has(key), `${key} should be displayed`).toBe(true);
    }
    // Defence exists only because we derived it.
    expect(groups.find((g) => g.title === "Defence")?.rows.map((r) => r.key)).toEqual([
      "tackles",
    ]);
  });

  it("drops groups with nothing to show", () => {
    const groups = visibleGroups(buildStatLookup(null, { home: {}, away: {} }));
    expect(groups).toEqual([]);
  });
});
