import type {
  MatchLineups,
  MatchPlayerBreakdown,
  MatchTeamStats,
  PlayerInfo,
} from "@/types/events";

/** A row's value as the provider sends it: 8, "52%", "1.41", or null. Some
 *  numeric fields also arrive wrapped as {source, parsedValue}. */
export type StatValue = string | number | null | undefined | { parsedValue?: unknown };

export type StatRow = {
  /** Provider key, or a derived key from DERIVED_KEYS. */
  key: string;
  label: string;
};

export type StatGroup = {
  title: string;
  rows: StatRow[];
  /** Rendered larger and without a visible header — the two numbers that carry
   *  the match. `title` still names the section for screen readers. */
  headline?: boolean;
};

/** Team totals we sum ourselves from the per-player sheet. `team_stats` carries
 *  no defensive numbers at all, so these can only come from player_breakdowns. */
export const DERIVED_KEYS = [
  "tackles",
  "interceptions",
  "clearances",
  "blocks",
  "duels_won",
] as const;

/** Order matters — this is the reading order of the whole block. Keys are
 *  API-Football's own `type` strings, verbatim from the stat sheet, except the
 *  DERIVED_KEYS in Defence.
 *
 *  Every key appears EXACTLY ONCE. An earlier cut repeated total shots and pass
 *  accuracy in a "Top stats" block the way FotMob does, but FotMob's summary is
 *  a visually separate card; stacked in one panel the repeat just reads as a
 *  rendering bug. The headline group carries the two numbers that genuinely
 *  summarise a match instead.
 *
 *  `goals_prevented` is deliberately absent — the provider reports an identical
 *  value for both sides, so it isn't a per-team figure. */
export const STAT_GROUPS: readonly StatGroup[] = [
  {
    title: "Top stats",
    headline: true,
    rows: [
      { key: "Ball Possession", label: "Possession" },
      { key: "expected_goals", label: "Expected goals" },
    ],
  },
  {
    title: "Shots",
    rows: [
      { key: "Total Shots", label: "Total shots" },
      { key: "Shots on Goal", label: "On target" },
      { key: "Shots off Goal", label: "Off target" },
      { key: "Blocked Shots", label: "Blocked" },
      { key: "Shots insidebox", label: "Inside box" },
      { key: "Shots outsidebox", label: "Outside box" },
      { key: "Corner Kicks", label: "Corners" },
    ],
  },
  {
    title: "Passes",
    rows: [
      { key: "Total passes", label: "Total passes" },
      { key: "Passes accurate", label: "Accurate passes" },
      { key: "Passes %", label: "Pass accuracy" },
    ],
  },
  {
    title: "Defence",
    rows: [
      { key: "Goalkeeper Saves", label: "Saves" },
      { key: "tackles", label: "Tackles" },
      { key: "interceptions", label: "Interceptions" },
      { key: "clearances", label: "Clearances" },
      { key: "blocks", label: "Blocks" },
      { key: "duels_won", label: "Duels won" },
    ],
  },
  {
    title: "Discipline",
    rows: [
      { key: "Fouls", label: "Fouls" },
      { key: "Offsides", label: "Offsides" },
      { key: "Yellow Cards", label: "Yellow cards" },
      { key: "Red Cards", label: "Red cards" },
    ],
  },
];

/** The number behind a provider value, for bar widths. Returns null when there
 *  is no number to read — which is NOT the same as 0 and must stay distinct, or
 *  an unreported stat would render as a real zero. */
export function toNumber(value: StatValue): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    return "parsedValue" in value ? toNumber(value.parsedValue as StatValue) : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  // "52%" -> 52. Anything else numeric ("1.41", "-0.57") parses directly —
  // expected_goals arrives as a string, and without this every xG bar
  // collapsed to the neutral 50/50 split.
  const parsed = Number(trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Display string for a provider value; an em-dash when nothing was reported. */
export function displayValue(value: StatValue): string {
  if (value === null || value === undefined) return "–";
  if (typeof value === "object") {
    return "parsedValue" in value ? displayValue(value.parsedValue as StatValue) : "–";
  }
  return String(value);
}

type Side = "home" | "away";

/** Which side each player was on, from the lineups (authoritative for THIS
 *  match), falling back to their stored club.
 *
 *  The fallback alone is not enough: a player's stored `team` can be stale or
 *  simply wrong — one Elche bench player is stored under "Atletico Madrid" —
 *  and matching on it would drop them from both sides' totals. */
function sideByPlayer(
  lineups: MatchLineups | null | undefined,
  players: Record<string, PlayerInfo>,
  homeTeam: string | null,
  awayTeam: string | null,
): Map<string, Side> {
  const side = new Map<string, Side>();

  const claim = (entries: { player_id: string }[] | undefined, which: Side) => {
    for (const entry of entries ?? []) side.set(entry.player_id, which);
  };
  claim(lineups?.home, "home");
  claim(lineups?.home_bench, "home");
  claim(lineups?.away, "away");
  claim(lineups?.away_bench, "away");

  for (const [playerId, info] of Object.entries(players)) {
    if (side.has(playerId) || !info.team) continue;
    if (info.team === homeTeam) side.set(playerId, "home");
    else if (info.team === awayTeam) side.set(playerId, "away");
  }
  return side;
}

/** Sum the per-player stat sheet into team totals for DERIVED_KEYS.
 *
 *  Returns null for a key when NEITHER side reported it, so an absent stat stays
 *  absent instead of rendering as 0-0. */
export function deriveTeamTotals(
  breakdowns: Record<string, MatchPlayerBreakdown> | null | undefined,
  lineups: MatchLineups | null | undefined,
  players: Record<string, PlayerInfo>,
  homeTeam: string | null,
  awayTeam: string | null,
): { home: Record<string, number | null>; away: Record<string, number | null> } {
  const side = sideByPlayer(lineups, players, homeTeam, awayTeam);
  const totals = {
    home: {} as Record<string, number | null>,
    away: {} as Record<string, number | null>,
  };
  const reported = new Set<string>();

  for (const [playerId, breakdown] of Object.entries(breakdowns ?? {})) {
    const which = side.get(playerId);
    if (!which) continue;
    for (const key of DERIVED_KEYS) {
      const value = toNumber(breakdown.stats?.[key] as StatValue);
      if (value === null) continue;
      reported.add(key);
      totals[which][key] = (totals[which][key] ?? 0) + value;
    }
  }

  for (const key of DERIVED_KEYS) {
    // A derived stat that totals zero on BOTH sides was never really reported —
    // the sheet carries an explicit 0 for every player when the provider
    // doesn't cover it (clearances, on every La Liga fixture seen so far), and
    // a 0–0 row with a 50/50 bar says nothing. Provider-sent zeroes are left
    // alone; only these summed ones are suppressed.
    if (!reported.has(key) || !(totals.home[key] || totals.away[key])) {
      delete totals.home[key];
      delete totals.away[key];
      continue;
    }
    totals.home[key] ??= 0;
    totals.away[key] ??= 0;
  }
  return totals;
}

/** Merge the provider sheet with our derived totals into one lookup per side. */
export function buildStatLookup(
  teamStats: MatchTeamStats | null | undefined,
  derived: { home: Record<string, number | null>; away: Record<string, number | null> },
): { home: Record<string, StatValue>; away: Record<string, StatValue> } {
  return {
    home: { ...(teamStats?.home ?? {}), ...derived.home },
    away: { ...(teamStats?.away ?? {}), ...derived.away },
  };
}

/** Drop rows neither side reported, then drop groups left with no rows. */
export function visibleGroups(lookup: {
  home: Record<string, StatValue>;
  away: Record<string, StatValue>;
}): StatGroup[] {
  return STAT_GROUPS.map((group) => ({
    ...group,
    rows: group.rows.filter(
      (row) =>
        (lookup.home[row.key] ?? null) !== null || (lookup.away[row.key] ?? null) !== null,
    ),
  })).filter((group) => group.rows.length > 0);
}
