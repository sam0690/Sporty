import { describe, it, expect } from "vitest";

import { groupRulesIntoCategories } from "./scoringCategories";

describe("groupRulesIntoCategories", () => {
  it("collapses per-position duplicates into one row with a point range", () => {
    const cats = groupRulesIntoCategories([
      { action: "goal", description: "Goal — GK (+6)", points: 6 },
      { action: "goal", description: "Goal — DEF (+6)", points: 6 },
      { action: "goal", description: "Goal — MID (+5)", points: 5 },
      { action: "goal", description: "Goal — FWD (+4)", points: 4 },
    ]);

    expect(cats).toHaveLength(1);
    expect(cats[0].id).toBe("attacking");
    expect(cats[0].count).toBe(1); // one distinct action, not four rows
    const goal = cats[0].rules[0];
    expect(goal.label).toBe("Goal");
    expect(goal.minPoints).toBe(4);
    expect(goal.maxPoints).toBe(6);
    expect(goal.ruleCount).toBe(4);
  });

  it("routes unknown/future actions to the general bucket instead of crashing", () => {
    const cats = groupRulesIntoCategories([
      { action: "some_new_rule", description: "?", points: 1 },
    ]);
    expect(cats[0].id).toBe("general");
    expect(cats[0].rules[0].label).toBe("Some New Rule");
  });

  it("returns non-empty categories sorted by display order", () => {
    const cats = groupRulesIntoCategories([
      { action: "red_card", description: "Red card", points: -3 }, // discipline (4)
      { action: "goal", description: "Goal", points: 5 }, // attacking (1)
    ]);
    expect(cats.map((c) => c.id)).toEqual(["attacking", "discipline"]);
  });

  it("returns an empty array for no rules", () => {
    expect(groupRulesIntoCategories([])).toEqual([]);
  });
});
