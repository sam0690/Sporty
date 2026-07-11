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
  const accentColor = sportAccentColor[player.sportName] ?? "#71717d";

  return (
    <article
      style={{ borderLeft: `3px solid ${accentColor}` }}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[3px] border border-white/8 bg-surface-1 px-4 py-3 transition-colors hover:border-white/15"
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
            <p className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-fg-1">
              {player.name}
            </p>
            {player.isCaptain ? (
              <span className="shrink-0 rounded-[3px] border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-accent">
                C
              </span>
            ) : null}
            {player.isViceCaptain ? (
              <span className="shrink-0 rounded-[3px] border border-white/15 bg-surface-3 px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-fg-1">
                VC
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 flex items-center truncate text-xs text-fg-3">
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
                  ? "border-accent/40 bg-accent/12 text-accent"
                  : "border-white/8 bg-surface-3 text-fg-2 hover:text-accent"
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
                  ? "border-white/25 bg-surface-3 text-fg-1"
                  : "border-white/8 bg-surface-3 text-fg-2 hover:text-fg-1"
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
                ? "border-white/8 bg-surface-3 text-fg-3"
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
