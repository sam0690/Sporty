import { describe, expect, it } from "vitest";

import { ALL_CLUBS, buildClubOptions, type ClubTeam } from "./clubOptions";

const football = { name: "football", display_name: "Football" };
const basketball = { name: "basketball", display_name: "Basketball" };

const team = (
  name: string,
  competition: string | null,
  sport = football,
): ClubTeam => ({ name, competition, sport });

// Deliberately shuffled — the API orders by name, the grouping must not rely on it.
const TEAMS: ClubTeam[] = [
  team("Bayern Munich", "BUNDESLIGA"),
  team("Real Madrid", "LALIGA"),
  team("Arsenal", "EPL"),
  team("Barcelona", "LALIGA"),
  team("Sheffield United", null), // relegated — no competition tag
  team("Los Angeles Lakers", null, basketball),
  team("Chelsea", "EPL"),
];

const groups = (options: { group?: string }[]) => [
  ...new Set(options.map((o) => o.group)),
];

describe("buildClubOptions", () => {
  it('pins "All Clubs" first and ungrouped', () => {
    const options = buildClubOptions(TEAMS);
    expect(options[0]).toEqual({ value: ALL_CLUBS, label: "All Clubs" });
  });

  it("orders groups EPL → La Liga → Bundesliga → other sports → Other", () => {
    expect(groups(buildClubOptions(TEAMS))).toEqual([
      undefined, // All Clubs
      "Premier League",
      "La Liga",
      "Bundesliga",
      "Basketball",
      "Other",
    ]);
  });

  it("sorts clubs alphabetically inside a group", () => {
    const epl = buildClubOptions(TEAMS).filter(
      (o) => o.group === "Premier League",
    );
    expect(epl.map((o) => o.value)).toEqual(["Arsenal", "Chelsea"]);
  });

  it("buckets an untagged football club under Other, not Football", () => {
    const sheffield = buildClubOptions(TEAMS).find(
      (o) => o.value === "Sheffield United",
    );
    expect(sheffield?.group).toBe("Other");
  });

  it("buckets a non-football club under its sport", () => {
    const lakers = buildClubOptions(TEAMS).find(
      (o) => o.value === "Los Angeles Lakers",
    );
    expect(lakers?.group).toBe("Basketball");
  });

  it("uses the club name as the value (the backend filters on the name)", () => {
    expect(buildClubOptions([team("Arsenal", "EPL")])[1]).toEqual({
      value: "Arsenal",
      label: "Arsenal",
      group: "Premier League",
    });
  });

  it("restrictTo drops everything outside the list but keeps All Clubs", () => {
    const options = buildClubOptions(TEAMS, ["Arsenal", "Real Madrid"]);
    expect(options.map((o) => o.value)).toEqual([
      ALL_CLUBS,
      "Arsenal",
      "Real Madrid",
    ]);
  });

  it("drops clubs sharing a name across sports — the filter is name-based", () => {
    const options = buildClubOptions([
      team("Phoenix", "EPL"),
      team("Phoenix", null, basketball),
    ]);
    expect(options.filter((o) => o.value === "Phoenix")).toHaveLength(1);
  });

  it("returns just All Clubs for empty or missing input", () => {
    expect(buildClubOptions(undefined)).toEqual([
      { value: ALL_CLUBS, label: "All Clubs" },
    ]);
    expect(buildClubOptions([])).toHaveLength(1);
  });
});
