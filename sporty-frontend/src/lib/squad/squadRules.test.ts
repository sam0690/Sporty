import { describe, expect, it } from "vitest";
import {
  buildSquadValidation,
  clubWarnings,
  MULTISPORT_MIN_BY_SPORT,
  SQUAD_SIZES,
  type SquadPlayer,
} from "./squadRules";

function footballers(count: number, position = "MID", realTeam = "FC A"): SquadPlayer[] {
  return Array.from({ length: count }, () => ({
    sport: "football",
    position,
    realTeam,
  }));
}

function ballers(count: number): SquadPlayer[] {
  return Array.from({ length: count }, () => ({
    sport: "basketball",
    position: "SG",
    realTeam: "BC B",
  }));
}

describe("buildSquadValidation", () => {
  it("passes a complete football squad within budget", () => {
    const rules = buildSquadValidation({
      players: footballers(SQUAD_SIZES.football),
      leagueSport: "football",
      includeBudgetRule: true,
      remainingBudget: 3.5,
      positionMinimums: {},
    });
    expect(rules.every((rule) => rule.satisfied)).toBe(true);
  });

  it("fails squad size when incomplete and flags overspent budget", () => {
    const rules = buildSquadValidation({
      players: footballers(3),
      leagueSport: "football",
      includeBudgetRule: true,
      remainingBudget: -0.5,
      positionMinimums: {},
    });
    const byKey = Object.fromEntries(rules.map((rule) => [rule.key, rule]));
    expect(byKey.size.satisfied).toBe(false);
    expect(byKey.size.detail).toBe(`3/${SQUAD_SIZES.football}`);
    expect(byKey.budget.satisfied).toBe(false);
  });

  it("omits the budget rule in draft mode", () => {
    const rules = buildSquadValidation({
      players: footballers(1),
      leagueSport: "football",
      includeBudgetRule: false,
      remainingBudget: 0,
      positionMinimums: {},
    });
    expect(rules.find((rule) => rule.key === "budget")).toBeUndefined();
  });

  it("enforces the multisport 8/7 split", () => {
    const short = buildSquadValidation({
      players: [
        ...footballers(MULTISPORT_MIN_BY_SPORT.football),
        ...ballers(MULTISPORT_MIN_BY_SPORT.basketball - 1),
      ],
      leagueSport: "multisport",
      includeBudgetRule: false,
      remainingBudget: 0,
      positionMinimums: {},
    });
    const byKey = Object.fromEntries(short.map((rule) => [rule.key, rule]));
    expect(byKey.football.satisfied).toBe(true);
    expect(byKey.basketball.satisfied).toBe(false);
  });

  it("checks backend-provided position minimums", () => {
    const rules = buildSquadValidation({
      players: footballers(2, "GKP"),
      leagueSport: "football",
      includeBudgetRule: false,
      remainingBudget: 0,
      positionMinimums: { GKP: 2, DEF: 5 },
    });
    const byKey = Object.fromEntries(rules.map((rule) => [rule.key, rule]));
    expect(byKey["position-GKP"].satisfied).toBe(true);
    expect(byKey["position-DEF"].satisfied).toBe(false);
    expect(byKey["position-DEF"].detail).toBe("0/5");
  });

  it("fails only when a club is OVER the cap, not at it", () => {
    const atCap = buildSquadValidation({
      players: footballers(3, "MID", "Arsenal"),
      leagueSport: "football",
      includeBudgetRule: false,
      remainingBudget: 0,
      positionMinimums: {},
      maxPerClub: 3,
    });
    expect(
      atCap.find((rule) => rule.key === "max-per-club")?.satisfied,
    ).toBe(true);

    const overCap = buildSquadValidation({
      players: footballers(4, "MID", "Arsenal"),
      leagueSport: "football",
      includeBudgetRule: false,
      remainingBudget: 0,
      positionMinimums: {},
      maxPerClub: 3,
    });
    const rule = overCap.find((r) => r.key === "max-per-club");
    expect(rule?.satisfied).toBe(false);
    expect(rule?.detail).toBe("4/3");
  });

  it("omits the club rule when the league has no cap", () => {
    const rules = buildSquadValidation({
      players: footballers(4),
      leagueSport: "football",
      includeBudgetRule: false,
      remainingBudget: 0,
      positionMinimums: {},
    });
    expect(rules.find((rule) => rule.key === "max-per-club")).toBeUndefined();
  });
});

describe("clubWarnings", () => {
  it("returns only clubs at or past the cap", () => {
    const players = [...footballers(3, "MID", "Arsenal"), ...footballers(2, "MID", "Spurs")];
    expect(clubWarnings(players, 3)).toEqual([
      { club: "Arsenal", count: 3, max: 3 },
    ]);
  });

  it("is empty when no cap is configured", () => {
    expect(clubWarnings(footballers(5), undefined)).toEqual([]);
  });

  it("never pools players with no club data into one fake club", () => {
    // Auto-pick used to return clubless players; bucketing them together
    // reported a bogus "15/3" and disabled the submit button.
    const clubless = footballers(15, "MID", "");
    expect(clubWarnings(clubless, 3)).toEqual([]);

    const rule = buildSquadValidation({
      players: clubless,
      leagueSport: "football",
      includeBudgetRule: false,
      remainingBudget: 0,
      positionMinimums: {},
      maxPerClub: 3,
    }).find((r) => r.key === "max-per-club");
    expect(rule?.satisfied).toBe(true);
    expect(rule?.detail).toBe("0/3");
  });
});
