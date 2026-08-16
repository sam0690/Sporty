// Visual identity for a team: its real brand colour (see teamColors.ts, which
// also handles the dark-surface contrast tuning) plus initials for the crest
// fallback. Teams we have no colour on file for get a neutral — a wrong club
// colour reads worse than no colour, and the crest is the identifier anyway.

import { brandColor, separateFromHome } from "@/lib/teamColors";

const NEUTRAL = "#a0a0aa";
/** Second neutral, for when BOTH clubs in a fixture are unknown to us — two
 *  identical greys would break the one guarantee matchIdentities makes. */
const NEUTRAL_ALT = "#7f8aa3";

export type TeamIdentity = {
  color: string;
  /** True when `color` is the club's real colour rather than the neutral
   *  fallback — lets callers skip decorative washes that would otherwise be
   *  a meaningless grey. */
  branded: boolean;
  initials: string;
};

export function teamIdentity(name?: string | null): TeamIdentity {
  const clean = (name ?? "").replace(/&amp;/gi, "&").trim();
  if (!clean) {
    return { color: NEUTRAL, branded: false, initials: "?" };
  }
  const color = brandColor(clean);
  const initials = clean
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/i.test(word))
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return {
    color: color ?? NEUTRAL,
    branded: color != null,
    initials: initials || "?",
  };
}

/**
 * Both sides of one fixture, guaranteed to render in colours a reader can tell
 * apart — Liverpool vs Manchester United is two near-identical reds otherwise,
 * and a red dot either side of the event feed's spine says nothing.
 *
 * The HOME club always keeps its true colour and the away club shifts, which
 * is both the real-world convention (the visitors change strip) and the less
 * surprising half to alter. Use this ANYWHERE both teams are shown together;
 * calling teamIdentity() twice re-introduces the clash.
 */
export function matchIdentities(
  homeName?: string | null,
  awayName?: string | null,
): { home: TeamIdentity; away: TeamIdentity } {
  const home = teamIdentity(homeName);
  const away = teamIdentity(awayName);
  if (home.color !== away.color && away.branded) {
    return { home, away: { ...away, color: separateFromHome(away.color, home.color) } };
  }
  if (home.color === away.color) {
    // Identical: either the same neutral twice (neither club known) or two
    // clubs whose tuned brand colours collapsed onto the same hex.
    return {
      home,
      away: {
        ...away,
        color: away.branded ? separateFromHome(away.color, home.color) : NEUTRAL_ALT,
      },
    };
  }
  return { home, away };
}
