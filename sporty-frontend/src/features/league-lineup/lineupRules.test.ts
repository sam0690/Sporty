import { describe, expect, it } from "vitest";
import {
  detectLineupSport,
  groupPlayersBySport,
  lineupFingerprint,
  parseNumericCost,
  positionBaselineProjection,
  SPORT_LINEUP_RULES,
} from "./lineupRules";

describe("detectLineupSport", () => {
  it("returns the single sport for football/basketball squads", () => {
    expect(detectLineupSport([{ sportName: "football" }])).toBe("football");
    expect(detectLineupSport([{ sportName: "basketball" }])).toBe("basketball");
  });

  it("returns multisport for mixed or unknown squads", () => {
    expect(
      detectLineupSport([{ sportName: "football" }, { sportName: "basketball" }]),
    ).toBe("multisport");
    expect(detectLineupSport([{ sportName: "cricket" }])).toBe("multisport");
    expect(detectLineupSport([])).toBe("multisport");
  });
});

describe("groupPlayersBySport", () => {
  it("buckets players by display name, preserving order", () => {
    const players = [
      { sportDisplayName: "Football", name: "a" },
      { sportDisplayName: "Basketball", name: "b" },
      { sportDisplayName: "Football", name: "c" },
    ];
    const grouped = groupPlayersBySport(players);
    expect(Object.keys(grouped)).toEqual(["Football", "Basketball"]);
    expect(grouped.Football.map((p) => p.name)).toEqual(["a", "c"]);
  });
});

describe("lineupFingerprint", () => {
  const base = {
    isStarter: true,
    isCaptain: false,
    isViceCaptain: false,
  };

  it("is order-independent", () => {
    const a = [
      { playerId: "1", ...base },
      { playerId: "2", ...base, isCaptain: true },
    ];
    expect(lineupFingerprint(a)).toBe(lineupFingerprint([...a].reverse()));
  });

  it("changes when starter/captain flags change", () => {
    const before = [{ playerId: "1", ...base }];
    const benched = [{ playerId: "1", ...base, isStarter: false }];
    const banded = [{ playerId: "1", ...base, isViceCaptain: true }];
    expect(lineupFingerprint(before)).not.toBe(lineupFingerprint(benched));
    expect(lineupFingerprint(before)).not.toBe(lineupFingerprint(banded));
  });
});

describe("positionBaselineProjection", () => {
  it("ranks attacking positions above defensive ones", () => {
    expect(positionBaselineProjection("FWD")).toBeGreaterThan(
      positionBaselineProjection("MID"),
    );
    expect(positionBaselineProjection("MID")).toBeGreaterThan(
      positionBaselineProjection("DEF"),
    );
    expect(positionBaselineProjection("DEF")).toBeGreaterThan(
      positionBaselineProjection("GKP"),
    );
  });

  it("gives every basketball position and unknowns a positive baseline", () => {
    for (const pos of ["PG", "SG", "SF", "PF", "C", "??"]) {
      expect(positionBaselineProjection(pos)).toBeGreaterThan(0);
    }
  });
});

describe("parseNumericCost", () => {
  it("parses numeric strings and falls back to 0", () => {
    expect(parseNumericCost("7.5")).toBe(7.5);
    expect(parseNumericCost("not-a-number")).toBe(0);
    expect(parseNumericCost("")).toBe(0);
  });
});

describe("SPORT_LINEUP_RULES", () => {
  it("starters + bench always equals total", () => {
    for (const rules of Object.values(SPORT_LINEUP_RULES)) {
      expect(rules.starters + rules.bench).toBe(rules.total);
    }
  });
});
