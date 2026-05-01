"use client";

type LeagueRow = {
  id: number;
  name: string;
  sport: "football" | "basketball" | "cricket" | "multisport";
  rank: number;
  points: number;
};

type LeagueHistoryProps = {
  leagues: LeagueRow[];
};

function sportLabel(sport: LeagueRow["sport"]): string {
  if (sport === "multisport") {
    return "Multi-Sport";
  }

  return sport.slice(0, 1).toUpperCase() + sport.slice(1);
}

export function LeagueHistory({ leagues }: LeagueHistoryProps) {
  return (
    <section className="rounded-lg border border-accent/20 bg-white p-5">
      <h3 className="text-base font-medium text-black">League History</h3>

      <div className="mt-4 space-y-3">
        {leagues.map((league) => (
          <article key={league.id} className="rounded-md border border-accent/20 bg-[#F4F4F9] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-black">{league.name}</p>
                <p className="text-xs text-secondary">{sportLabel(league.sport)}</p>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Rank #{league.rank}
              </span>
            </div>
            <p className="mt-2 text-sm text-black">{league.points} points</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { LeagueRow };
