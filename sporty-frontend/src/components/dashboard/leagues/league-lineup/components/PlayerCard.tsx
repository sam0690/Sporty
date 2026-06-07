"use client";

import type { LineupPlayerCardModel } from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";

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
      className={`rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4 transition-colors ${
        player.isCaptain
          ? "border-l-[#e8fb25]"
          : player.isViceCaptain
            ? "border-l-[#555560]"
            : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            {player.name}
          </p>
          <p className="mt-1 text-sm text-[#555560]">{player.realTeam}</p>
        </div>
        <div className="flex items-center gap-1">
          {player.isCaptain ? (
            <span className="rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-2 py-0.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#e8fb25]">
              C
            </span>
          ) : null}
          {player.isViceCaptain ? (
            <span className="rounded-[3px] border border-[rgba(255,255,255,0.15)] bg-[#1d1d26] px-2 py-0.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#f0f0f0]">
              VC
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-2.5 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#f0f0f0]">
          {player.position}
        </span>
        <span
          className="rounded-[3px] px-2.5 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px]"
          style={{ color: accentColor, background: `${accentColor}18` }}
        >
          {player.sportDisplayName}
        </span>
      </div>

      <p className="mt-3 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
        Cost: {player.cost}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleStarter?.(player.playerId)}
          disabled={disabled || starterToggleDisabled}
          className={`rounded-[3px] border px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            player.isStarter
              ? "border-[rgba(255,59,48,0.3)] bg-[#2a1010] text-[#ff3b30] hover:bg-[rgba(255,59,48,0.2)]"
              : starterToggleDisabled
                ? "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560]"
                : "border-[rgba(76,175,80,0.3)] bg-[#1a2a1a] text-[#4caf50] hover:bg-[rgba(76,175,80,0.2)]"
          }`}
        >
          {player.isStarter
            ? "Move to Bench"
            : starterToggleDisabled
              ? "Starter Limit Reached"
              : "Move to Starting Lineup"}
        </button>

        {player.isStarter ? (
          <>
            <button
              type="button"
              onClick={() => onSetCaptain?.(player.playerId)}
              disabled={disabled}
              className="rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#e8fb25] transition-colors hover:bg-[rgba(232,251,37,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Set Captain
            </button>
            <button
              type="button"
              onClick={() => onSetViceCaptain?.(player.playerId)}
              disabled={disabled}
              className="rounded-[3px] border border-[rgba(255,255,255,0.15)] bg-[#1d1d26] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#f0f0f0] transition-colors hover:bg-[rgba(255,255,255,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Set Vice-Captain
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
