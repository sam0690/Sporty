"use client";

import { useMemo } from "react";

import type { TCompetitionMatch } from "@/types/competition";

const FINISHED = new Set(["FINISHED", "AWARDED"]);

function kickoff(dt: string) {
  const d = new Date(dt);
  return {
    day: d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

function Row({ match, showScore }: { match: TCompetitionMatch; showScore: boolean }) {
  const { day, time } = kickoff(match.utcDate);
  const home = match.score?.fullTime?.home;
  const away = match.score?.fullTime?.away;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/3">
      <div className="flex items-center justify-end gap-2 text-right">
        <span className="truncate text-sm font-500 text-fg-1">
          {match.homeTeam.name}
        </span>
        {match.homeTeam.crest && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.homeTeam.crest} alt="" className="size-5 shrink-0 object-contain" loading="lazy" />
        )}
      </div>
      {showScore && home != null && away != null ? (
        <div className="rounded-[3px] bg-surface-3 px-2.5 py-1 text-center text-sm font-700 tabular-nums text-fg-1">
          {home}–{away}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-700 tabular-nums text-fg-1">{time}</p>
          <p className="text-[10px] uppercase tracking-wide text-fg-3">{day}</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        {match.awayTeam.crest && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.awayTeam.crest} alt="" className="size-5 shrink-0 object-contain" loading="lazy" />
        )}
        <span className="truncate text-sm font-500 text-fg-1">
          {match.awayTeam.name}
        </span>
      </div>
    </div>
  );
}

export function CompetitionMatches({
  matches,
  mode,
}: {
  matches: TCompetitionMatch[];
  mode: "fixtures" | "results";
}) {
  const groups = useMemo(() => {
    const wanted = matches.filter((m) =>
      mode === "results" ? FINISHED.has(m.status) : !FINISHED.has(m.status),
    );
    wanted.sort((a, b) =>
      mode === "results"
        ? new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
        : new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
    );
    const byDay = new Map<number, TCompetitionMatch[]>();
    for (const m of wanted) {
      const md = m.matchday ?? 0;
      (byDay.get(md) ?? byDay.set(md, []).get(md)!).push(m);
    }
    return [...byDay.entries()].sort((a, b) =>
      mode === "results" ? b[0] - a[0] : a[0] - b[0],
    );
  }, [matches, mode]);

  if (groups.length === 0) {
    return (
      <div className="card-surface px-6 py-12 text-center">
        <p className="text-sm text-fg-2">
          {mode === "results"
            ? "No results yet this season."
            : "No upcoming fixtures scheduled."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([matchday, dayMatches]) => (
        <details key={matchday} open className="overflow-hidden card-surface">
          <summary className="flex cursor-pointer items-center justify-between border-b border-white/8 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <p className="section-label">
              {matchday ? `Matchday ${matchday}` : "Fixtures"}
            </p>
            <span className="text-xs text-fg-3">{dayMatches.length}</span>
          </summary>
          <div className="divide-y divide-white/6">
            {dayMatches.map((m) => (
              <Row key={m.id} match={m} showScore={mode === "results"} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
