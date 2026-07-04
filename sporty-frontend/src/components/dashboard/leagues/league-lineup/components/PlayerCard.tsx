"use client";

import type { LineupPlayerCardModel } from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";
import { PlayerAvatar, TeamLogo } from "@/components/ui";

type PlayerCardProps = {
  player: LineupPlayerCardModel;
  onToggleStarter?: (playerId: string) => void;
  onSetCaptain?: (playerId: string) => void;
  onSetViceCaptain?: (playerId: string) => void;
  starterToggleDisabled?: boolean;
  disabled?: boolean;
};

const sportAccentColor: Record<string, string> = {
  football: "#4caf50",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
};

export function PlayerCard({
  player,
  onToggleStarter,
  onSetCaptain,
  onSetViceCaptain,
  starterToggleDisabled = false,
  disabled = false,
}: PlayerCardProps) {
  const accentColor = sportAccentColor[player.sportName] ?? "#555560";

  return (
    <article
      style={{ borderLeft: `3px solid ${accentColor}` }}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-4 py-3 transition-colors hover:border-[rgba(255,255,255,0.15)]"
    >
      {/* Identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size="md" className="shrink-0" />
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[3px] font-barlow-condensed text-xs font-700 uppercase tracking-[0.5px]"
          style={{ color: accentColor, background: `${accentColor}1f` }}
        >
          {player.position}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
              {player.name}
            </p>
            {player.isCaptain ? (
              <span className="shrink-0 rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#e8fb25]">
                C
              </span>
            ) : null}
            {player.isViceCaptain ? (
              <span className="shrink-0 rounded-[3px] border border-[rgba(255,255,255,0.15)] bg-[#1d1d26] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                VC
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 flex items-center truncate text-xs text-[#555560]">
            {player.realTeam ? (
              <span className="flex items-center gap-1.5">
                <TeamLogo teamName={player.realTeam} logoUrl={player.realTeamLogoUrl} size="sm" />
                {player.realTeam}
              </span>
            ) : null}
            <span className="mx-1.5 text-[#33333a]">·</span>
            <span style={{ color: accentColor }}>{player.sportDisplayName}</span>
            <span className="mx-1.5 text-[#33333a]">·</span>${player.cost}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {player.isStarter ? (
          <>
            <button
              type="button"
              onClick={() => onSetCaptain?.(player.playerId)}
              disabled={disabled}
              className={`rounded-[3px] border px-3 py-1.5 font-barlow-condensed text-[11px] font-700 uppercase tracking-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                player.isCaptain
                  ? "border-[rgba(232,251,37,0.4)] bg-[rgba(232,251,37,0.12)] text-[#e8fb25]"
                  : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5] hover:text-[#e8fb25]"
              }`}
            >
              {player.isCaptain ? "Captain" : "Set C"}
            </button>
            <button
              type="button"
              onClick={() => onSetViceCaptain?.(player.playerId)}
              disabled={disabled}
              className={`rounded-[3px] border px-3 py-1.5 font-barlow-condensed text-[11px] font-700 uppercase tracking-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                player.isViceCaptain
                  ? "border-[rgba(255,255,255,0.25)] bg-[#1d1d26] text-[#f0f0f0]"
                  : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5] hover:text-[#f0f0f0]"
              }`}
            >
              {player.isViceCaptain ? "Vice" : "Set VC"}
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => onToggleStarter?.(player.playerId)}
          disabled={disabled || starterToggleDisabled}
          className={`rounded-[3px] border px-3.5 py-1.5 font-barlow-condensed text-[11px] font-700 uppercase tracking-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            player.isStarter
              ? "border-[rgba(255,59,48,0.3)] bg-[rgba(255,59,48,0.08)] text-[#ff3b30] hover:bg-[rgba(255,59,48,0.16)]"
              : starterToggleDisabled
                ? "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560]"
                : "border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.1)] text-[#4caf50] hover:bg-[rgba(76,175,80,0.2)]"
          }`}
        >
          {player.isStarter
            ? "Bench"
            : starterToggleDisabled
              ? "Full"
              : "Start"}
        </button>
      </div>
    </article>
  );
}
