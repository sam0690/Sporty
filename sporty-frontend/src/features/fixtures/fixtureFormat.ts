import type { TFixture } from "@/types/fixture";

export type FixtureGroup = {
  competition: string;
  sport: string;
  fixtures: TFixture[];
  live: number;
  followed: boolean;
};

function isLive(f: TFixture): boolean {
  return (f.status ?? "").toLowerCase() === "live";
}

/** Group fixtures by competition. Groups: followed first, then groups with a
 *  live match, then alphabetical. Within a group: live first, then kickoff. */
export function groupFixturesByCompetition(
  fixtures: TFixture[],
  followed: ReadonlySet<string>,
): FixtureGroup[] {
  const map = new Map<string, FixtureGroup>();
  for (const f of fixtures) {
    const key = f.competition;
    let g = map.get(key);
    if (!g) {
      g = { competition: key, sport: f.sport, fixtures: [], live: 0, followed: followed.has(key) };
      map.set(key, g);
    }
    g.fixtures.push(f);
    if (isLive(f)) g.live += 1;
  }

  for (const g of map.values()) {
    g.fixtures.sort(
      (a, b) =>
        Number(isLive(b)) - Number(isLive(a)) ||
        a.match_date.localeCompare(b.match_date),
    );
  }

  return [...map.values()].sort(
    (a, b) =>
      Number(b.followed) - Number(a.followed) ||
      Number(b.live > 0) - Number(a.live > 0) ||
      a.competition.localeCompare(b.competition),
  );
}

export type LeagueEntry = {
  competition: string;
  sport: string;
  live: number;
  count: number;
  followed: boolean;
};

/** League list for the rail/sheet: every competition with fixtures today, plus
 *  any followed competition (even with no games today). Followed pinned top. */
export function leaguesFromFixtures(
  fixtures: TFixture[],
  followed: ReadonlySet<string>,
): LeagueEntry[] {
  const map = new Map<string, LeagueEntry>();
  for (const f of fixtures) {
    let e = map.get(f.competition);
    if (!e) {
      e = { competition: f.competition, sport: f.sport, live: 0, count: 0, followed: followed.has(f.competition) };
      map.set(f.competition, e);
    }
    e.count += 1;
    if (isLive(f)) e.live += 1;
  }
  // Followed competitions with no games today still appear (count 0).
  for (const name of followed) {
    if (!map.has(name)) {
      map.set(name, { competition: name, sport: "football", live: 0, count: 0, followed: true });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      Number(b.followed) - Number(a.followed) ||
      Number(b.live > 0) - Number(a.live > 0) ||
      a.competition.localeCompare(b.competition),
  );
}
