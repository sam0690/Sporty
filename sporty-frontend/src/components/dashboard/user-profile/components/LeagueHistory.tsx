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
  football: "#16A34A",
  basketball: "#EA580C",
  cricket: "#0891B2",
  multisport: "#DC2626",
};

function sportLabel(sport: LeagueRow["sport"]): string {
  if (sport === "multisport") {
    return "Multi-Sport";
  }
  return sport.slice(0, 1).toUpperCase() + sport.slice(1);
}

export function LeagueHistory({ leagues }: LeagueHistoryProps) {
  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
      <header className="border-b border-[rgba(11,18,32,0.08)] px-5 py-3">
        <p className="section-label">League History</p>
      </header>

      <div className="p-5">
        {leagues.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Not in any leagues yet.</p>
        ) : (
          <div className="space-y-2">
            {leagues.map((league) => {
              const accent = sportAccent[league.sport] ?? "#6B7280";
              return (
                <article
                  key={league.id}
                  style={{ borderLeft: `3px solid ${accent}` }}
                  className="flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
                      {league.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: accent }}>
                      {sportLabel(league.sport)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <div>
                      <p className="font-bebas text-lg leading-none tracking-[1px] text-[#0B1220]">
                        {league.rank > 0 ? `#${league.rank}` : "—"}
                      </p>
                      <p className="section-label mt-1">Rank</p>
                    </div>
                    <div>
                      <p className="font-bebas text-lg leading-none tracking-[1px] text-[#DC2626]">
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
