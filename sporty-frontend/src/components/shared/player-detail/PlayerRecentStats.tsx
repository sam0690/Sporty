"use client";

import { Users } from "lucide-react";
import { FootballGlyph } from "@/components/landing/sport-icons";
import type { TPlayerGameweekStat } from "@/types";

function RecentStatRow({ stat }: { stat: TPlayerGameweekStat }) {
  return (
    <div className="flex items-center justify-between rounded-[3px] border border-white/6 bg-[#16161d] px-3 py-2">
      <div className="micro-label text-fg-3">GW {stat.transfer_window.number}</div>
      <div className="flex items-center gap-3 text-xs text-fg-2">
        <span>{stat.minutes_played}&apos;</span>
        {stat.football_stat && (
          <>
            {stat.football_stat.goals > 0 && (
              <span className="flex items-center gap-1">
                <FootballGlyph className="size-3.5" />
                {stat.football_stat.goals}
              </span>
            )}
            {stat.football_stat.assists > 0 && (
              <span className="flex items-center gap-1">
                <Users className="size-3.5" />
                {stat.football_stat.assists}
              </span>
            )}
            {stat.football_stat.yellow_cards > 0 && (
              <span
                aria-label={`${stat.football_stat.yellow_cards} yellow card${stat.football_stat.yellow_cards > 1 ? "s" : ""}`}
                className="h-3 w-2.5 rounded-[1px] bg-[#e8c525]"
              />
            )}
            {stat.football_stat.red_cards > 0 && (
              <span
                aria-label={`${stat.football_stat.red_cards} red card${stat.football_stat.red_cards > 1 ? "s" : ""}`}
                className="h-3 w-2.5 rounded-[1px] bg-danger"
              />
            )}
          </>
        )}
      </div>
      <div className="num text-sm font-700 text-success">{stat.fantasy_points} pts</div>
    </div>
  );
}

type PlayerRecentStatsProps = {
  stats: TPlayerGameweekStat[] | undefined;
  isLoading: boolean;
};

export function PlayerRecentStats({ stats, isLoading }: PlayerRecentStatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="skeleton h-10 rounded-[3px]" />
        <div className="skeleton h-10 rounded-[3px]" />
      </div>
    );
  }
  if (!stats || stats.length === 0) {
    return <p className="text-sm text-fg-2">No recent gameweek data yet.</p>;
  }
  return (
    <div className="space-y-2">
      {stats.map((stat, i) => (
        <RecentStatRow key={i} stat={stat} />
      ))}
    </div>
  );
}
