"use client";

import { useMemo } from "react";
import { PlayerAvatar } from "@/components/ui";
import type { TMatchup } from "@/types";

function fmtPoints(points: string | null): string | null {
  if (points === null) return null;
  const n = Number(points);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ScheduleRow({ matchup, myTeamId }: { matchup: TMatchup; myTeamId?: string }) {
  const isMine = matchup.home_team.id === myTeamId || matchup.away_team?.id === myTeamId;
  const isBye = matchup.result === "bye";

  return (
    <div
      className={`flex items-center gap-3 rounded-[3px] border px-3 py-2.5 ${
        isMine ? "border-accent/40 bg-accent/5" : "border-white/8"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <PlayerAvatar name={matchup.home_team.user.username} photoUrl={matchup.home_team.user.avatar_url} size="sm" />
        <span className="truncate text-sm text-fg-1">{matchup.home_team.name}</span>
      </div>

      {isBye ? (
        <span className="section-label shrink-0 text-fg-3">Bye</span>
      ) : (
        <>
          <span className="num shrink-0 text-sm text-fg-2">
            {fmtPoints(matchup.home_points) ?? "–"}
          </span>
          <span className="shrink-0 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-3">
            vs
          </span>
          <span className="num shrink-0 text-sm text-fg-2">
            {fmtPoints(matchup.away_points) ?? "–"}
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
            <span className="truncate text-sm text-fg-1">{matchup.away_team?.name}</span>
            <PlayerAvatar
              name={matchup.away_team?.user.username ?? "?"}
              photoUrl={matchup.away_team?.user.avatar_url}
              size="sm"
            />
          </div>
        </>
      )}
    </div>
  );
}

export function FullScheduleView({
  matchups,
  myTeamId,
}: {
  matchups: TMatchup[];
  myTeamId?: string;
}) {
  const byWindow = useMemo(() => {
    const groups = new Map<number, TMatchup[]>();
    for (const m of matchups) {
      const list = groups.get(m.window_number) ?? [];
      list.push(m);
      groups.set(m.window_number, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [matchups]);

  if (byWindow.length === 0) {
    return <p className="text-sm text-fg-3">No schedule generated yet.</p>;
  }

  return (
    <div className="space-y-4">
      {byWindow.map(([windowNumber, rows]) => (
        <div key={windowNumber}>
          <p className="section-label mb-2">Gameweek {windowNumber}</p>
          <div className="space-y-1.5">
            {rows.map((m) => (
              <ScheduleRow key={m.id} matchup={m} myTeamId={myTeamId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
