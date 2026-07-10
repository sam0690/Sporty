"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { usePlayer, usePlayerRecentStats } from "@/hooks/players/usePlayers";
import type { TPlayerGameweekStat } from "@/types";

type PlayerDetailModalProps = {
  playerId: string | null;
  onClose: () => void;
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
      <div className="micro-label text-[#6b6b76]">{label}</div>
      <div className="mt-1 text-sm text-[#f0f0f0]">{value}</div>
    </div>
  );
}

function RecentStatRow({ stat }: { stat: TPlayerGameweekStat }) {
  return (
    <div className="flex items-center justify-between rounded-[3px] border border-[rgba(255,255,255,0.06)] bg-[#16161d] px-3 py-2">
      <div className="micro-label text-[#6b6b76]">
        GW {stat.transfer_window.number}
      </div>
      <div className="flex items-center gap-4 text-xs text-[#9a9aa5]">
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
      <div className="num text-sm font-700 text-[#00ff88]">
        {stat.fantasy_points} pts
      </div>
    </div>
  );
}

export function PlayerDetailModal({ playerId, onClose }: PlayerDetailModalProps) {
  useEffect(() => {
    if (!playerId) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerId, onClose]);

  const { data: player, isLoading, isError } = usePlayer(playerId ?? "");
  const { data: recentStats, isLoading: statsLoading } = usePlayerRecentStats(playerId ?? "");

  if (!playerId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pop-in max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] text-[#f0f0f0]"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="p-6">
            <div className="skeleton h-16 w-16 rounded-[3px]" />
            <div className="skeleton mt-4 h-5 w-40 rounded-[3px]" />
            <div className="skeleton mt-2 h-4 w-24 rounded-[3px]" />
          </div>
        )}

        {isError && (
          <div className="p-6 text-center">
            <p className="text-sm text-[#f0f0f0]/65">
              Couldn&apos;t load this player. Try again.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm text-[#f0f0f0]"
            >
              Close
            </button>
          </div>
        )}

        {player && (
          <>
            <div className="relative p-6">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close player details"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5] transition-colors hover:bg-[#25252f] hover:text-[#f0f0f0]"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-4">
                <PlayerAvatar name={player.display_name} photoUrl={player.photo_url} size="lg" />
                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="truncate text-lg font-700 text-[#f0f0f0]">
                    {player.display_name}
                  </h2>
                  <div className="mt-1 flex items-center gap-2">
                    <TeamLogo teamName={player.real_team} logoUrl={player.real_team_logo_url} size="sm" />
                    <span className="text-sm text-[#9a9aa5]">{player.real_team}</span>
                    <span className="micro-label rounded-[3px] border border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.08)] px-1.5 py-0.5 text-[#00ff88]">
                      {player.position}
                    </span>
                  </div>
                  <div className="num mt-2 text-2xl font-700 text-[#f0f0f0]">
                    £{player.current_cost.toFixed(1)}m
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-[rgba(255,255,255,0.06)] px-6 py-4 sm:grid-cols-3">
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
              <div className="border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
                <div className="micro-label text-[#6b6b76]">About</div>
                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-[#9a9aa5]">
                  {player.bio}
                </p>
              </div>
            )}

            <div className="border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="micro-label mb-3 text-[#6b6b76]">Recent Performance</div>
              {statsLoading && (
                <div className="space-y-2">
                  <div className="skeleton h-10 rounded-[3px]" />
                  <div className="skeleton h-10 rounded-[3px]" />
                </div>
              )}
              {!statsLoading && (!recentStats || recentStats.length === 0) && (
                <p className="text-sm text-[#9a9aa5]">No recent gameweek data yet.</p>
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
        )}
      </div>
    </div>
  );
}
