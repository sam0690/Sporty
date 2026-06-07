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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
      <h3 className="text-base text-[#f0f0f0]">League History</h3>

      <div className="mt-4 space-y-3">
        {leagues.map((league) => (
          <article
            key={league.id}
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[#f0f0f0]">
                  {league.name}
                </p>
                <p className="text-xs text-[#555560]">
                  {sportLabel(league.sport)}
                </p>
              </div>
              <span className="rounded-[3px] border border-[rgba(232,251,37,0.2)] bg-[rgba(232,251,37,0.1)] px-2.5 py-1 text-xs text-[#e8fb25]">
                Rank #{league.rank}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#f0f0f0]">
              {league.points} points
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { LeagueRow };
