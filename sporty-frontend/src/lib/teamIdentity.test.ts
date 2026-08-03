import { describe, expect, it } from "vitest";
import {
  BRAND_COLORS,
  DARK_SURFACE,
  MIN_BRAND_CONTRAST,
  brandColor,
  contrastRatio,
} from "./teamColors";
import { teamIdentity } from "./teamIdentity";

describe("brandColor contrast", () => {
  // The whole point of the tuning pass: a club colour is only allowed on the
  // page once it clears WCAG 1.4.11 on the surfaces we actually render it on.
  it("clears the non-text floor for every club on both dark surfaces", () => {
    const failures: string[] = [];
    for (const name of Object.keys(BRAND_COLORS)) {
      const color = brandColor(name);
      expect(color, `${name} missing from lookup`).not.toBeNull();
      for (const bg of [DARK_SURFACE, "#0a0a0f"]) {
        const ratio = contrastRatio(color as string, bg);
        if (ratio < MIN_BRAND_CONTRAST) {
          failures.push(`${name} ${color} on ${bg} = ${ratio.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("leaves already-legible brand colours byte-identical", () => {
    // Arsenal red, Dortmund yellow and City sky pass untouched — tuning must
    // not wash out clubs that never needed it.
    expect(brandColor("Arsenal")).toBe("#ef0107");
    expect(brandColor("Borussia Dortmund")).toBe("#fde100");
    expect(brandColor("Manchester City")).toBe("#6cabdd");
  });

  it("lifts near-black brand colours instead of rendering a smudge", () => {
    const newcastle = brandColor("Newcastle United") as string;
    expect(newcastle).not.toBe("#241f20");
    expect(contrastRatio("#241F20", DARK_SURFACE)).toBeLessThan(2);
    expect(contrastRatio(newcastle, DARK_SURFACE)).toBeGreaterThanOrEqual(
      MIN_BRAND_CONTRAST,
    );
  });
});

describe("team name lookup", () => {
  it("resolves the name shapes that actually reach us", () => {
    // Left column is what `real_teams.name` / feeds hand us verbatim.
    const cases: [string, string][] = [
      ["Brighton &amp; Hove Albion", "Brighton & Hove Albion"],
      ["Brighton and Hove Albion", "Brighton & Hove Albion"],
      ["Liverpool FC", "Liverpool"],
      ["Man Utd", "Manchester United"],
      ["Bayern Munich", "Bayern München"],
      ["bayern münchen", "Bayern München"],
      ["LAL", "LAL"],
    ];
    for (const [input, canonical] of cases) {
      expect(brandColor(input), input).toBe(brandColor(canonical));
    }
  });

  it("falls back to neutral for teams with no colour on file", () => {
    const unknown = teamIdentity("Sub Test Town");
    expect(unknown.branded).toBe(false);
    expect(unknown.color).toBe("#a0a0aa");
    expect(unknown.initials).toBe("STT");
  });

  it("skips punctuation when building crest initials", () => {
    expect(teamIdentity("Brighton &amp; Hove Albion").initials).toBe("BHA");
    expect(teamIdentity("").initials).toBe("?");
  });
});
