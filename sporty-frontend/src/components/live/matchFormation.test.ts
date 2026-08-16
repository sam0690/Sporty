import { describe, expect, it } from "vitest";
import { buildTeamFormation } from "./matchFormation";
import type { LineupPlayer } from "@/types/events";

function xi(def: number, mid: number, fwd: number): LineupPlayer[] {
  const make = (pos: string, n: number, tag: string) =>
    Array.from({ length: n }, (_, i) => ({
      player_id: `${tag}${i}`,
      name: `${tag} ${i}`,
      position: pos,
    }));
  return [
    { player_id: "gk", name: "Keeper", position: "GK" },
    ...make("DEF", def, "d"),
    ...make("MID", mid, "m"),
    ...make("FWD", fwd, "f"),
  ];
}

describe("buildTeamFormation", () => {
  it("derives an honest DEF-MID-FWD label and places everyone", () => {
    const { label, chips } = buildTeamFormation(xi(4, 3, 3), "home");
    expect(label).toBe("4-3-3");
    expect(chips).toHaveLength(11);
    // Home keeper is the deepest (largest y).
    const gk = chips.find((c) => c.isGk)!;
    expect(gk.y).toBe(Math.max(...chips.map((c) => c.y)));
    expect(gk.y).toBeGreaterThan(0.5);
  });

  it("keeps a 2-forward shape as 4-4-2 and drops the FWD digit when none", () => {
    expect(buildTeamFormation(xi(4, 4, 2), "home").label).toBe("4-4-2");
    expect(buildTeamFormation(xi(5, 5, 0), "home").label).toBe("5-5");
  });

  it("splits a crowded midfield across rows so no row exceeds 4", () => {
    // 3-7-1 used to render as one 7-wide row; it must now split.
    const { chips } = buildTeamFormation(xi(3, 7, 1), "home");
    const byRow = new Map<number, number>();
    for (const c of chips) byRow.set(c.y, (byRow.get(c.y) ?? 0) + 1);
    expect(Math.max(...byRow.values())).toBeLessThanOrEqual(4);
  });

  it("slots a position-less player into the thinnest outfield line", () => {
    // 2 DEF, 5 MID, 2 FWD + one unknown → unknown fills DEF (thinnest) → 3-5-2.
    const players: LineupPlayer[] = [
      ...xi(2, 5, 2),
      { player_id: "x", name: null, position: null },
    ];
    const { label, chips } = buildTeamFormation(players, "home");
    expect(label).toBe("3-5-2");
    expect(chips).toHaveLength(11);
    // The unmapped player is placed (not dropped).
    expect(chips.some((c) => c.id === "x")).toBe(true);
  });

  it("mirrors the away team into the top half, facing home", () => {
    const { chips } = buildTeamFormation(xi(4, 3, 3), "away");
    const gk = chips.find((c) => c.isGk)!;
    expect(gk.y).toBe(Math.min(...chips.map((c) => c.y)));
    expect(gk.y).toBeLessThan(0.5);
    for (const c of chips) expect(c.y).toBeLessThanOrEqual(0.5);
  });
});

describe("buildTeamFormation reported label", () => {
  it("prefers the provider's shape over the derived three-line guess", () => {
    // A real 3-4-2-1 (GK + 3 + 6 + 1) reads as "3-6-1" off position buckets
    // alone, because the buckets can't tell a 4-2 midfield split from a flat 6.
    expect(buildTeamFormation(xi(3, 6, 1), "home").label).toBe("3-6-1");

    const { label, chips } = buildTeamFormation(xi(3, 6, 1), "home", "3-4-2-1");
    expect(label).toBe("3-4-2-1");
    // Layout still comes from the buckets — only the text changes.
    expect(chips).toHaveLength(11);
  });

  it("falls back to the derived label when the feed omits one", () => {
    for (const missing of [undefined, null, "", "   "]) {
      expect(buildTeamFormation(xi(4, 4, 2), "home", missing).label).toBe("4-4-2");
    }
  });
});
