import { describe, expect, it } from "vitest";
import {
  buildTeamLayout,
  computeFootballBucketCounts,
  FOOTBALL_FORMATION_BOUNDS,
  getFootballFormationBucket,
  isFootballGoalkeeper,
  MULTISPORT_STARTER_REQUIREMENTS,
  validateFootballFormation,
  type FormationPlayerLike,
} from "./formationEngine";

let nextId = 0;
function player(
  position: string,
  sport = "football",
  overrides: Partial<FormationPlayerLike> = {},
): FormationPlayerLike {
  nextId += 1;
  return {
    id: `p${nextId}`,
    name: `Player ${nextId}`,
    position,
    sport,
    ...overrides,
  };
}

function xi(def: number, mid: number, fwd: number): FormationPlayerLike[] {
  return [
    player("GK"),
    ...Array.from({ length: def }, () => player("CB")),
    ...Array.from({ length: mid }, () => player("CM")),
    ...Array.from({ length: fwd }, () => player("ST")),
  ];
}

describe("getFootballFormationBucket", () => {
  it("maps raw position strings to the four FPL buckets", () => {
    expect(getFootballFormationBucket("gk")).toBe("GK");
    expect(getFootballFormationBucket("Goalkeeper")).toBe("GK");
    expect(getFootballFormationBucket("LWB")).toBe("DEF");
    expect(getFootballFormationBucket("Defender")).toBe("DEF");
    expect(getFootballFormationBucket("CDM")).toBe("MID");
    expect(getFootballFormationBucket("CAM")).toBe("MID");
    expect(getFootballFormationBucket("RW")).toBe("MID");
    expect(getFootballFormationBucket("ST")).toBe("FWD");
    expect(getFootballFormationBucket("Centre Forward ")).toBe("FWD");
  });

  it("defaults unknown positions to MID", () => {
    expect(getFootballFormationBucket("???")).toBe("MID");
  });
});

describe("isFootballGoalkeeper", () => {
  it("accepts GK, GKP, and verbose labels regardless of case/whitespace", () => {
    expect(isFootballGoalkeeper(" gk ")).toBe(true);
    expect(isFootballGoalkeeper("GKP")).toBe(true);
    expect(isFootballGoalkeeper("Goalkeeper")).toBe(true);
    expect(isFootballGoalkeeper("CB")).toBe(false);
  });
});

describe("validateFootballFormation", () => {
  it("accepts every legal FPL shape at the bounds", () => {
    expect(validateFootballFormation(xi(4, 4, 2)).ok).toBe(true);
    expect(validateFootballFormation(xi(3, 5, 2)).ok).toBe(true);
    expect(validateFootballFormation(xi(5, 2, 3)).ok).toBe(true);
    expect(validateFootballFormation(xi(5, 4, 1)).ok).toBe(true);
  });

  it("rejects a missing goalkeeper", () => {
    const noKeeper = xi(4, 4, 2).filter((p) => p.position !== "GK");
    const result = validateFootballFormation(noKeeper);
    expect(result.ok).toBe(false);
  });

  it("rejects two goalkeepers", () => {
    const result = validateFootballFormation([...xi(4, 4, 1), player("GK")]);
    expect(result.ok).toBe(false);
  });

  it("rejects too few defenders and too many forwards", () => {
    expect(validateFootballFormation(xi(2, 6, 2)).ok).toBe(false);
    expect(validateFootballFormation(xi(3, 3, 4)).ok).toBe(false);
  });

  it("returns a human-readable reason on failure", () => {
    const result = validateFootballFormation(xi(2, 6, 2));
    expect(result).toEqual({
      ok: false,
      reason: "You need at least 3 defenders.",
    });
  });
});

describe("computeFootballBucketCounts", () => {
  it("counts each bucket", () => {
    expect(computeFootballBucketCounts(xi(4, 3, 3))).toEqual({
      GK: 1,
      DEF: 4,
      MID: 3,
      FWD: 3,
    });
  });
});

describe("buildTeamLayout", () => {
  it("labels a standard 4-4-2 and renders every starter into a slot", () => {
    const layout = buildTeamLayout(xi(4, 4, 2));
    expect(layout.mode).toBe("football");
    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0].formationLabel).toBe("4-4-2");
    const placed = layout.sections[0].slots.filter((slot) => slot.player);
    expect(placed).toHaveLength(11);
  });

  it("uses basketball mode for an all-basketball squad", () => {
    const layout = buildTeamLayout(
      ["PG", "SG", "SF", "PF", "C"].map((pos) => player(pos, "basketball")),
    );
    expect(layout.mode).toBe("basketball");
    expect(layout.sections[0].surface).toBe("court");
    expect(layout.sections[0].slots.filter((slot) => slot.player)).toHaveLength(
      5,
    );
  });

  it("uses one unified multisport section for a mixed squad", () => {
    const football = [
      player("GK"),
      player("CB"),
      player("CB"),
      player("CM"),
      player("ST"),
    ];
    const basketball = ["PG", "SG", "SF", "PF"].map((pos) =>
      player(pos, "basketball"),
    );
    const layout = buildTeamLayout([...football, ...basketball]);
    expect(layout.mode).toBe("mixed");
    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0].surface).toBe("multisport");
    expect(layout.sportSummary).toEqual({ football: 5, basketball: 4 });
    expect(
      layout.sections[0].slots.filter((slot) => slot.player),
    ).toHaveLength(9);
  });

  it("keeps the squad's surface when activeOnly filters out every starter", () => {
    const squad = ["PG", "SG", "SF", "PF", "C"].map((pos) =>
      player(pos, "basketball", { isStarter: false }),
    );
    const layout = buildTeamLayout(squad, { activeOnly: true });
    expect(layout.mode).toBe("basketball");
  });
});

describe("shared constants", () => {
  it("multisport starters sum to the 9-player multisport lineup", () => {
    expect(
      MULTISPORT_STARTER_REQUIREMENTS.football +
        MULTISPORT_STARTER_REQUIREMENTS.basketball,
    ).toBe(9);
  });

  it("FPL bounds allow a full XI (1 GK + 10 outfielders)", () => {
    const { GK, DEF, MID, FWD } = FOOTBALL_FORMATION_BOUNDS;
    expect(GK.min + DEF.min + MID.min + FWD.min).toBeLessThanOrEqual(11);
    expect(GK.max + DEF.max + MID.max + FWD.max).toBeGreaterThanOrEqual(11);
  });
});
