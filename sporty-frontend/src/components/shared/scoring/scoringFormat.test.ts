import { describe, expect, it } from "vitest";

import {
  formatSignedPoints,
  pointsTone,
  scoreActionLabel,
} from "./scoringFormat";

describe("scoringFormat", () => {
  it("labels known actions and humanizes unknown ones (future sports)", () => {
    expect(scoreActionLabel("clean_sheet")).toBe("Clean Sheet");
    expect(scoreActionLabel("defensive_contribution")).toBe("Defensive Actions");
    // unknown action → title-cased, never blank (sport-agnostic)
    expect(scoreActionLabel("some_new_metric")).toBe("Some New Metric");
  });

  it("tones: positive green, negative red, bonus gold", () => {
    expect(pointsTone(5)).toBe("positive");
    expect(pointsTone(-2)).toBe("negative");
    expect(pointsTone(3, "bonus")).toBe("bonus");
    expect(pointsTone(0)).toBe("neutral");
  });

  it("signs points and trims float noise", () => {
    expect(formatSignedPoints(5)).toBe("+5");
    expect(formatSignedPoints(-2)).toBe("-2");
    expect(formatSignedPoints(1.005)).toBe("+1"); // rounded to 2dp
  });
});
