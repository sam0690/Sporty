"use client";

type Sport = "football" | "basketball" | "cricket";

type PlayerCardProps = {
  name: string;
  sport: Sport;
  position: string;
  realTeam?: string;
  cost?: string;
  totalPoints: number;
  avgPoints: number;
  teamName?: string;
};

const sportAccent: Record<Sport, string> = {
  football: "#16A34A",
  basketball: "#EA580C",
  cricket: "#0891B2",
};

const sportLabel: Record<Sport, string> = {
  football: "Football",
  basketball: "Basketball",
  cricket: "Cricket",
};

export function PlayerCard({
  name,
  sport,
  position,
  realTeam,
  cost,
  totalPoints,
  avgPoints,
}: PlayerCardProps) {
  const accent = sportAccent[sport] ?? "#6B7280";

  return (
    <article
      style={{ borderLeft: `3px solid ${accent}` }}
      className="card-fade-in flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-3 transition-colors hover:border-[rgba(11,18,32,0.18)]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="grid h-11 w-14 shrink-0 place-items-center rounded-[3px] font-barlow-condensed text-xs font-bold uppercase tracking-[0.5px]"
          style={{ color: accent, background: `${accent}1f` }}
        >
          {position}
        </span>
        <div className="min-w-0">
          <p className="truncate font-barlow-condensed text-base font-bold uppercase tracking-[1px] text-[#0B1220]">
            {name}
          </p>
          <p className="mt-0.5 truncate text-xs text-[#6B7280]">
            <span style={{ color: accent }}>{sportLabel[sport]}</span>
            {realTeam ? (
              <>
                <span className="mx-1.5 text-[#EAECF0]">·</span>
                {realTeam}
              </>
            ) : null}
            {cost ? (
              <>
                <span className="mx-1.5 text-[#EAECF0]">·</span>${cost}M
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-right">
        <div>
          <p className="font-bebas text-2xl leading-none tracking-[1px] text-[#DC2626]">
            {totalPoints}
          </p>
          <p className="section-label mt-1">Points</p>
        </div>
        <div>
          <p className="font-bebas text-lg leading-none tracking-[1px] text-[#6B7280]">
            {avgPoints.toFixed(1)}
          </p>
          <p className="section-label mt-1">Avg</p>
        </div>
      </div>
    </article>
  );
}

export type { PlayerCardProps, Sport };
