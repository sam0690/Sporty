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
    // Home defends the TOP goal, so its keeper has the smallest y.
    const gk = chips.find((c) => c.isGk)!;
    expect(gk.y).toBe(Math.min(...chips.map((c) => c.y)));
    expect(gk.y).toBeLessThan(0.5);
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

  it("mirrors the away team into the bottom half, facing home", () => {
    const { chips } = buildTeamFormation(xi(4, 3, 3), "away");
    const gk = chips.find((c) => c.isGk)!;
    expect(gk.y).toBe(Math.max(...chips.map((c) => c.y)));
    expect(gk.y).toBeGreaterThan(0.5);
    for (const c of chips) expect(c.y).toBeGreaterThanOrEqual(0.5);
  });
});

describe("buildTeamFormation reported label", () => {
  it("uses the provider label as the text when there is nothing better", () => {
    // Bare position strings carry no grid, and "3-4-2-1" doesn't sum to the
    // 10 outfielders here, so layout stays bucket-derived — only text changes.
    expect(buildTeamFormation(xi(3, 6, 1), "home").label).toBe("3-6-1");
    const { label, chips } = buildTeamFormation(xi(3, 6, 1), "home", "3-4-2-1");
    expect(label).toBe("3-4-2-1");
    expect(chips).toHaveLength(11);
  });

  it("falls back to the derived label when the feed omits one", () => {
    for (const missing of [undefined, null, "", "   "]) {
      expect(buildTeamFormation(xi(4, 4, 2), "home", missing).label).toBe("4-4-2");
    }
  });

  it("lays out from the formation digits when they account for the XI", () => {
    // No grid, but 4+2+3+1 == the 10 outfielders, so slice in arrival order
    // rather than bucketing: four distinct outfield rows, not a 4-5-1 split.
    const { chips } = buildTeamFormation(xi(4, 5, 1), "home", "4-2-3-1");
    const byRow = new Map<number, number>();
    for (const c of chips) byRow.set(c.y, (byRow.get(c.y) ?? 0) + 1);
    expect([...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n))
      .toEqual([1, 4, 2, 3, 1]);
  });

  it("ignores a formation whose digits do not account for the XI", () => {
    // 4+4+2 = 10 outfielders but this XI has 9 -> must not drop the tail.
    const { chips } = buildTeamFormation(xi(3, 5, 1), "home", "4-4-2");
    expect(chips).toHaveLength(10);
  });
});

describe("buildTeamFormation provider grid", () => {
  const gridXI = (rows: number[]): LineupPlayer[] => {
    const out: LineupPlayer[] = [];
    rows.forEach((count, rowIndex) => {
      for (let col = 1; col <= count; col++) {
        out.push({
          player_id: `r${rowIndex + 1}c${col}`,
          name: `R${rowIndex + 1}C${col}`,
          grid: `${rowIndex + 1}:${col}`,
          match_position: rowIndex === 0 ? "G" : "D",
        });
      }
    });
    return out;
  };

  it("reproduces a 4-2-3-1 exactly, whatever the stored positions say", () => {
    // Every player is tagged "D" here: a bucket-based layout would pile all
    // ten outfielders into one defensive row.
    const { chips } = buildTeamFormation(gridXI([1, 4, 2, 3, 1]), "home");
    const byRow = new Map<number, number>();
    for (const c of chips) byRow.set(c.y, (byRow.get(c.y) ?? 0) + 1);
    expect([...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n))
      .toEqual([1, 4, 2, 3, 1]);
  });

  it("orders a row left to right by ascending column", () => {
    // Sevilla's back four: Suazo (left-back) is col 1, Iglesias (right-back)
    // col 4. Home defends the top and attacks downward, so its own left is the
    // viewer's right -> ascending column must run right to left on screen.
    const { chips } = buildTeamFormation(gridXI([1, 4]), "home");
    const back = chips.filter((c) => c.id.startsWith("r2")).sort((a, b) => b.x - a.x);
    expect(back.map((c) => c.id)).toEqual(["r2c1", "r2c2", "r2c3", "r2c4"]);

    // Away attacks upward, so its columns read left to right on screen.
    const awayChips = buildTeamFormation(gridXI([1, 4]), "away").chips;
    const awayBack = awayChips.filter((c) => c.id.startsWith("r2")).sort((a, b) => a.x - b.x);
    expect(awayBack.map((c) => c.id)).toEqual(["r2c1", "r2c2", "r2c3", "r2c4"]);
  });

  it("falls back to buckets when the grid is only partial", () => {
    // A half-known grid would interleave real rows with guesses.
    const players = gridXI([1, 4]);
    players[2] = { ...players[2], grid: null, position: "DEF" };
    const { chips } = buildTeamFormation(players, "home");
    expect(chips).toHaveLength(5);
  });

  it("badges players by the position they actually played", () => {
    const players = gridXI([1, 1]);
    players[1] = { ...players[1], match_position: "F", position: "DEF" };
    const { chips } = buildTeamFormation(players, "home");
    expect(chips.find((c) => c.id === "r2c1")!.role).toBe("FWD");
  });
});
