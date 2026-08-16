import { describe, expect, it } from "vitest";

import { matchIdentities, teamIdentity } from "@/lib/teamIdentity";
import {
  BRAND_COLORS,
  DARK_SURFACE,
  MIN_BRAND_CONTRAST,
  MIN_TEAM_SEPARATION,
  brandColor,
  colorDistance,
  contrastRatio,
} from "@/lib/teamColors";

const CLUBS = Object.keys(BRAND_COLORS);

describe("matchIdentities", () => {
  it("never gives both sides of a fixture the same colour", () => {
    // Every ordered pair of every club we have a colour for. Real clashes this
    // catches: Deportivo La Coruna vs Real Sociedad and Bayer Leverkusen vs
    // VfB Stuttgart are IDENTICAL hexes, and Liverpool vs Manchester United is
    // two reds a reader can't separate at dot size.
    for (const home of CLUBS) {
      for (const away of CLUBS) {
        if (home === away) continue;
        const { home: h, away: a } = matchIdentities(home, away);
        expect(
          colorDistance(h.color, a.color),
          `${home} vs ${away} render too close together`,
        ).toBeGreaterThanOrEqual(MIN_TEAM_SEPARATION);
      }
    }
  });

  it("leaves the home club's real colour alone", () => {
    // The visitors change strip, not the hosts — anything else looks wrong to
    // someone who knows the club.
    for (const home of CLUBS) {
      const { home: h } = matchIdentities(home, "Liverpool");
      expect(h.color).toBe(brandColor(home));
    }
  });

  it("does not touch clubs that already look different", () => {
    for (const [home, away] of [
      ["Arsenal", "Chelsea"],
      ["Arsenal", "Aston Villa"],
      ["Manchester City", "Liverpool"],
    ] as const) {
      const { away: a } = matchIdentities(home, away);
      expect(a.color).toBe(brandColor(away));
    }
  });

  it("separates two clubs that share a brand colour", () => {
    // Same hex on file for both.
    expect(BRAND_COLORS["Bayer Leverkusen"]).toBe(BRAND_COLORS["VfB Stuttgart"]);
    const { home, away } = matchIdentities("Bayer Leverkusen", "VfB Stuttgart");
    expect(away.color).not.toBe(home.color);
  });

  it("keeps a shifted colour legible on the dark surface", () => {
    // A de-clashed colour still drives borders, rings and meters, so it has to
    // clear the same contrast bar as any brand colour.
    for (const away of CLUBS) {
      const { away: a } = matchIdentities("Liverpool", away);
      expect(
        contrastRatio(a.color, DARK_SURFACE),
        `${away} unreadable after separation`,
      ).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    }
  });

  it("separates two clubs we have no colour for at all", () => {
    // Both fall back to the neutral, which would otherwise be one grey twice.
    const { home, away } = matchIdentities("Unknown FC", "Mystery United");
    expect(teamIdentity("Unknown FC").branded).toBe(false);
    expect(away.color).not.toBe(home.color);
  });

  it("survives missing team names", () => {
    const { home, away } = matchIdentities(null, undefined);
    expect(home.color).not.toBe(away.color);
  });
});
