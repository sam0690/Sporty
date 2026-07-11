"use client";

import { Badge, PlayerAvatar, StatTile, TeamLogo } from "@/components/ui";
import { usePlayer, usePlayerRecentStats } from "@/hooks/players/usePlayers";
import type { TPlayerGameweekStat } from "@/types";

type PlayerDetailContentProps = {
  playerId: string;
};

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasNotHadBirthdayThisYear =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (hasNotHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

function BioField({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return (
    <div>
      <div className="micro-label text-fg-3">{label}</div>
      <div className="mt-1 text-sm text-fg-1">{value}</div>
    </div>
  );
}

function RecentStatRow({ stat }: { stat: TPlayerGameweekStat }) {
  return (
    <div className="flex items-center justify-between rounded-[3px] border border-white/6 bg-[#16161d] px-3 py-2">
      <div className="micro-label text-fg-3">
        GW {stat.transfer_window.number}
      </div>
      <div className="flex items-center gap-4 text-xs text-fg-2">
        <span>{stat.minutes_played}&apos;</span>
        {stat.football_stat && (
          <>
            {stat.football_stat.goals > 0 && <span>⚽ {stat.football_stat.goals}</span>}
            {stat.football_stat.assists > 0 && <span>🅰 {stat.football_stat.assists}</span>}
            {stat.football_stat.yellow_cards > 0 && (
              <span className="text-[#e8c525]">🟨 {stat.football_stat.yellow_cards}</span>
            )}
            {stat.football_stat.red_cards > 0 && (
              <span className="text-danger">🟥 {stat.football_stat.red_cards}</span>
            )}
          </>
        )}
      </div>
      <div className="num text-sm font-700 text-success">
        {stat.fantasy_points} pts
      </div>
    </div>
  );
}

export function PlayerDetailContent({ playerId }: PlayerDetailContentProps) {
  const { data: player, isLoading, isError } = usePlayer(playerId);
  const { data: recentStats, isLoading: statsLoading } = usePlayerRecentStats(playerId);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="skeleton h-16 w-16 rounded-[3px]" />
        <div className="skeleton mt-4 h-5 w-40 rounded-[3px]" />
        <div className="skeleton mt-2 h-4 w-24 rounded-[3px]" />
      </div>
    );
  }

  if (isError || !player) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-fg-1/65">
          Couldn&apos;t load this player. Try again.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <PlayerAvatar name={player.display_name} photoUrl={player.photo_url} size="lg" />
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="truncate text-lg font-700 text-fg-1">
              {player.display_name}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <TeamLogo teamName={player.real_team} logoUrl={player.real_team_logo_url} size="sm" />
              <span className="text-sm text-fg-2">{player.real_team}</span>
              <Badge tone="success" size="sm">
                {player.position}
              </Badge>
            </div>
            <StatTile
              className="mt-2"
              label="Price"
              value={`£${player.current_cost.toFixed(1)}m`}
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-white/6 px-6 py-4 sm:grid-cols-3">
        <BioField label="Nationality" value={player.nationality} />
        <BioField
          label="Age"
          value={player.date_of_birth ? calculateAge(player.date_of_birth) : null}
        />
        <BioField label="Height" value={player.height} />
        <BioField label="Weight" value={player.weight} />
        <BioField label="Squad Number" value={player.jersey_number} />
        <BioField label="Agent" value={player.agent} />
      </div>

      {player.bio && (
        <div className="border-t border-white/6 px-6 py-4">
          <div className="micro-label text-fg-3">About</div>
          <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-fg-2">
            {player.bio}
          </p>
        </div>
      )}

      <div className="border-t border-white/6 px-6 py-4">
        <div className="micro-label mb-3 text-fg-3">Recent Performance</div>
        {statsLoading && (
          <div className="space-y-2">
            <div className="skeleton h-10 rounded-[3px]" />
            <div className="skeleton h-10 rounded-[3px]" />
          </div>
        )}
        {!statsLoading && (!recentStats || recentStats.length === 0) && (
          <p className="text-sm text-fg-2">No recent gameweek data yet.</p>
        )}
        {!statsLoading && recentStats && recentStats.length > 0 && (
          <div className="space-y-2">
            {recentStats.map((stat, i) => (
              <RecentStatRow key={i} stat={stat} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
