import { describe, expect, it } from "vitest";
import { formatCountdown } from "./countdown";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatCountdown", () => {
  it("shows days + hours when over a day out", () => {
    expect(formatCountdown(2 * DAY + 4 * HOUR, 0)).toBe("2d 4h");
  });
  it("shows hours + minutes under a day", () => {
    expect(formatCountdown(3 * HOUR + 12 * MIN, 0)).toBe("3h 12m");
  });
  it("shows minutes only under an hour", () => {
    expect(formatCountdown(8 * MIN, 0)).toBe("8m");
  });
  it("never shows 0m while time remains", () => {
    expect(formatCountdown(30_000, 0)).toBe("1m");
  });
  it("is empty once the deadline has passed", () => {
    expect(formatCountdown(0, HOUR)).toBe("");
  });
});
