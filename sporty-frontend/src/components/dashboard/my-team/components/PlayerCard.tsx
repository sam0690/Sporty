"use client";

import { PlayerAvatar, TeamLogo } from "@/components/ui";

type Sport = "football" | "basketball" | "cricket";

type PlayerCardProps = {
  name: string;
  sport: Sport;
  position: string;
  realTeam?: string;
  photoUrl?: string | null;
  realTeamLogoUrl?: string | null;
  cost?: string;
  totalPoints: number;
  avgPoints: number;
  gameweekPoints: number;
  teamName?: string;
};

const sportAccent: Record<Sport, string> = {
  football: "#4caf50",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
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
  photoUrl,
  realTeamLogoUrl,
  cost,
  totalPoints,
  avgPoints,
  gameweekPoints,
}: PlayerCardProps) {
  const accent = sportAccent[sport] ?? "#9a9aa5";

  return (
    <article
      style={{ borderLeft: `3px solid ${accent}` }}
      className="card-fade-in flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-4 py-3 transition-colors hover:border-[rgba(255,255,255,0.18)]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar name={name} photoUrl={photoUrl} size="md" className="shrink-0" />
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[3px] font-barlow-condensed text-xs font-700 uppercase tracking-[0.5px]"
          style={{ color: accent, background: `${accent}1f` }}
        >
          {position}
        </span>
        <div className="min-w-0">
          <p className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            {name}
          </p>
          <p className="mt-1 flex items-center truncate text-xs text-[#555560]">
            <span style={{ color: accent }}>{sportLabel[sport]}</span>
            {realTeam ? (
              <span className="ml-1.5 flex items-center gap-1.5 border-l border-[#33333a] pl-1.5">
                <TeamLogo teamName={realTeam} logoUrl={realTeamLogoUrl} size="sm" />
                {realTeam}
              </span>
            ) : null}
            {cost ? (
              <>
                <span className="mx-1.5 text-[#33333a]">·</span>${cost}M
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-right">
        <div>
          <p className="font-bebas text-2xl leading-none tracking-[1px] text-[#e8fb25]">
            {Math.round(totalPoints)}
          </p>
          <p className="section-label mt-1">Points</p>
        </div>
        <div>
          <p className="font-bebas text-lg leading-none tracking-[1px] text-[#9a9aa5]">
            {gameweekPoints > 0 ? `+${Math.round(gameweekPoints)}` : Math.round(gameweekPoints)}
          </p>
          <p className="section-label mt-1">GW</p>
        </div>
        <div>
          <p className="font-bebas text-lg leading-none tracking-[1px] text-[#9a9aa5]">
            {avgPoints.toFixed(1)}
          </p>
          <p className="section-label mt-1">Avg</p>
        </div>
      </div>
    </article>
  );
}

export type { PlayerCardProps, Sport };
