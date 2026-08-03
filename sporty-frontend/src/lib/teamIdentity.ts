// Visual identity for a team: its real brand colour (see teamColors.ts, which
// also handles the dark-surface contrast tuning) plus initials for the crest
// fallback. Teams we have no colour on file for get a neutral — a wrong club
// colour reads worse than no colour, and the crest is the identifier anyway.

import { brandColor } from "@/lib/teamColors";

const NEUTRAL = "#a0a0aa";

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
