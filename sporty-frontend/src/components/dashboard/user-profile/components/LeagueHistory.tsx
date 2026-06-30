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

const sportAccent: Record<LeagueRow["sport"], string> = {
  football: "#4caf50",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
  multisport: "#e8fb25",
};

function sportLabel(sport: LeagueRow["sport"]): string {
  if (sport === "multisport") {
    return "Multi-Sport";
  }
  return sport.slice(0, 1).toUpperCase() + sport.slice(1);
}

export function LeagueHistory({ leagues }: LeagueHistoryProps) {
  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <header className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <p className="section-label">League History</p>
      </header>

      <div className="p-5">
        {leagues.length === 0 ? (
          <p className="text-sm text-[#555560]">Not in any leagues yet.</p>
        ) : (
          <div className="space-y-2">
            {leagues.map((league) => {
              const accent = sportAccent[league.sport] ?? "#9a9aa5";
              return (
                <article
                  key={league.id}
                  style={{ borderLeft: `3px solid ${accent}` }}
                  className="flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                      {league.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: accent }}>
                      {sportLabel(league.sport)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <div>
                      <p className="font-bebas text-lg leading-none tracking-[1px] text-[#f0f0f0]">
                        {league.rank > 0 ? `#${league.rank}` : "—"}
                      </p>
                      <p className="section-label mt-1">Rank</p>
                    </div>
                    <div>
                      <p className="font-bebas text-lg leading-none tracking-[1px] text-[#e8fb25]">
                        {Math.round(league.points)}
                      </p>
                      <p className="section-label mt-1">Pts</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export type { LeagueRow };
