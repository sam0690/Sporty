import type { TMatch } from "@/types/match";

export function kickoffTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function statusMeta(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return {
    isLive: s === "live",
    isFinished: s === "finished",
    isScheduled: s === "scheduled" || s === "",
  };
}

export type MatchGroup = {
  competition: string;
  sport: string;
  matches: TMatch[];
  live: number;
};

export function groupByCompetition(items: TMatch[]): MatchGroup[] {
  const map = new Map<string, MatchGroup>();
  for (const m of items) {
    const key = m.competition || m.sport || "Fixtures";
    if (!map.has(key)) {
      map.set(key, { competition: key, sport: m.sport, matches: [], live: 0 });
    }
    const g = map.get(key)!;
    g.matches.push(m);
    if (statusMeta(m.status).isLive) g.live += 1;
  }
  const liveRank = (m: TMatch) => (statusMeta(m.status).isLive ? 0 : 1);
  return [...map.values()]
    .map((g) => ({
      ...g,
      matches: g.matches.sort(
        (a, b) =>
          liveRank(a) - liveRank(b) ||
          new Date(a.match_date).getTime() - new Date(b.match_date).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        (b.live > 0 ? 1 : 0) - (a.live > 0 ? 1 : 0) ||
        new Date(a.matches[0].match_date).getTime() -
          new Date(b.matches[0].match_date).getTime(),
    );
}
