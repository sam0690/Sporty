"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

type StandingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  manager: string;
  points: number;
  rankDelta?: number | null;
  streak?: number;
  isManagerOfTheWeek?: boolean;
};

const MEDAL_STYLE: Record<number, string> = {
  1: "bg-[rgba(255,216,107,0.15)] text-[#ffd86b] border-[rgba(255,216,107,0.4)]",
  2: "bg-[rgba(200,208,220,0.12)] text-[#c8d0dc] border-[rgba(200,208,220,0.35)]",
  3: "bg-[rgba(205,127,50,0.15)] text-[#cd7f32] border-[rgba(205,127,50,0.4)]",
};

function RankDeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (!delta) return null;
  const isUp = delta > 0;
  const Icon = isUp ? ChevronUp : ChevronDown;
  return (
    <span
      className={`inline-flex items-center font-barlow-condensed text-[11px] font-700 ${
        isUp ? "text-[#4caf50]" : "text-[#ff3b30]"
      }`}
      title={`${isUp ? "Up" : "Down"} ${Math.abs(delta)} rank vs last gameweek`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta)}
    </span>
  );
}

type StandingsTableProps = {
  standings: StandingRow[];
  userTeamId: string;
  // Label for the points figure — "Points" for the season total,
  // "Gameweek Points" when a single gameweek is selected.
  pointsLabel?: string;
};

export function StandingsTable({
  standings,
  userTeamId,
  pointsLabel = "Points",
}: StandingsTableProps) {
  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] animate-fade-soft">
      <div className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <h2 className="font-barlow-condensed text-xs font-700 uppercase tracking-[3px] text-[#666]">
          {pointsLabel}
        </h2>
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.06)]">
        {standings.map((team) => {
          const isUser = team.teamId === userTeamId;
          const medalClass = MEDAL_STYLE[team.rank];

          return (
            <div
              key={team.teamId}
              className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#1d1d26] ${
                isUser
                  ? "border-l-2 border-[#e8fb25] bg-[rgba(232,251,37,0.05)]"
                  : "border-l-2 border-transparent"
              }`}
            >
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-[3px] border font-bebas text-lg tracking-[1px] ${
                    medalClass ?? "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5]"
                  }`}
                >
                  {team.rank}
                </span>
                <RankDeltaBadge delta={team.rankDelta} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                  {team.teamName}
                  {isUser && (
                    <span className="ml-2 section-label text-[#c8d85a]">You</span>
                  )}
                  {team.isManagerOfTheWeek && (
                    <span
                      className="ml-2 text-xs"
                      title="Manager of the Week — highest points last gameweek"
                    >
                      🔥
                    </span>
                  )}
                  {team.streak && team.streak >= 2 ? (
                    <span
                      className="ml-1.5 text-xs text-[#9a9aa5]"
                      title={`Top 3 for ${team.streak} gameweeks running`}
                    >
                      {team.streak}W
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#555560]">{team.manager}</p>
              </div>

              <span className="num shrink-0 font-bebas text-2xl tracking-[1px] text-[#e8fb25]">
                {Math.round(team.points)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export type { StandingRow };
