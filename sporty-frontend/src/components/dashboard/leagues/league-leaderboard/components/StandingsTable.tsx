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
  1: "bg-warning/15 text-warning border-warning/40",
  2: "bg-[rgba(200,208,220,0.12)] text-[#c8d0dc] border-[rgba(200,208,220,0.35)]",
  3: "bg-[rgba(205,127,50,0.15)] text-[#cd7f32] border-[rgba(205,127,50,0.4)]",
};

function RankDeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (!delta) return null;
  const isUp = delta > 0;
  const Icon = isUp ? ChevronUp : ChevronDown;
  return (
    <span
      className={`inline-flex items-center font-sans text-[11px] font-700 ${
        isUp ? "text-success" : "text-danger"
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
    <section className="overflow-hidden card-surface animate-fade-soft">
      <div className="border-b border-white/8 px-5 py-3">
        <h2 className="font-sans text-xs font-700 uppercase tracking-[3px] text-[#666]">
          {pointsLabel}
        </h2>
      </div>

      <div className="divide-y divide-white/6">
        {standings.map((team) => {
          const isUser = team.teamId === userTeamId;
          const medalClass = MEDAL_STYLE[team.rank];

          return (
            <div
              key={team.teamId}
              className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-3 ${
                isUser
                  ? "border-l-2 border-accent bg-accent/5"
                  : "border-l-2 border-transparent"
              }`}
            >
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-[3px] border font-display text-lg tracking-[-0.02em] ${
                    medalClass ?? "border-white/8 bg-surface-3 text-fg-2"
                  }`}
                >
                  {team.rank}
                </span>
                <RankDeltaBadge delta={team.rankDelta} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                  {team.teamName}
                  {isUser && (
                    <span className="ml-2 section-label text-accent-dim">You</span>
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
                      className="ml-1.5 text-xs text-fg-2"
                      title={`Top 3 for ${team.streak} gameweeks running`}
                    >
                      {team.streak}W
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-fg-3">{team.manager}</p>
              </div>

              <span className="num shrink-0 font-display text-2xl tracking-[-0.02em] text-accent">
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
