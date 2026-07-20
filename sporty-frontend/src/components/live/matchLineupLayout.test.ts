import { describe, expect, it } from "vitest";
import { placeMatchTeam } from "./matchLineupLayout";
import type { LineupPlayer } from "@/types/events";

const XI: LineupPlayer[] = [
  { player_id: "gk", name: "Keep Er", position: "GK" },
  ...["CB", "CB", "LB", "RB"].map((position, i) => ({
    player_id: `d${i}`,
    name: `Def ${i}`,
    position,
  })),
  ...["CM", "CM", "CAM"].map((position, i) => ({
    player_id: `m${i}`,
    name: `Mid ${i}`,
    position,
  })),
  ...["LW", "ST", "RW"].map((position, i) => ({
    player_id: `f${i}`,
    name: `Fwd ${i}`,
    position,
  })),
];

const FIVE: LineupPlayer[] = ["PG", "SG", "SF", "PF", "C"].map((position) => ({
  player_id: position.toLowerCase(),
  name: `Baller ${position}`,
  position,
}));

describe("placeMatchTeam", () => {
  it("places all 11 in the home half (bottom), keeper deepest", () => {
    const { placed, formationLabel } = placeMatchTeam(XI, "home", "football");
    expect(placed).toHaveLength(11);
    expect(formationLabel).toBeTruthy();
    for (const p of placed) {
      expect(p.y).toBeGreaterThanOrEqual(0.5);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    const gk = placed.find((p) => p.player.id === "gk");
    // Keeper is the deepest (largest y) home player.
    expect(gk!.y).toBe(Math.max(...placed.map((p) => p.y)));
  });

  it("mirrors the away XI into the top half so the teams face each other", () => {
    const { placed } = placeMatchTeam(XI, "away", "football");
    expect(placed).toHaveLength(11);
    for (const p of placed) {
      expect(p.y).toBeLessThanOrEqual(0.5);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
    const gk = placed.find((p) => p.player.id === "gk");
    // Away keeper is the shallowest (smallest y) — the top goal.
    expect(gk!.y).toBe(Math.min(...placed.map((p) => p.y)));
  });

  it("splits basketball fives across their own halves too", () => {
    const home = placeMatchTeam(FIVE, "home", "basketball");
    const away = placeMatchTeam(FIVE, "away", "basketball");
    expect(home.placed).toHaveLength(5);
    expect(away.placed).toHaveLength(5);
    for (const p of home.placed) {
      expect(p.y).toBeGreaterThanOrEqual(0.5);
    }
    for (const p of away.placed) {
      expect(p.y).toBeLessThanOrEqual(0.5);
    }
  });
});
