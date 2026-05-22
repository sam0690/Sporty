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

const sportAccentStyles: Record<string, string> = {
  football: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  basketball: "border-orange-400/20 bg-orange-500/10 text-orange-100",
  cricket: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
};

export function PlayerCard({
  player,
  onToggleStarter,
  onSetCaptain,
  onSetViceCaptain,
  starterToggleDisabled = false,
  disabled = false,
}: PlayerCardProps) {
  const captainStyle = player.isCaptain
    ? "border-yellow-400/20 bg-yellow-500/10"
    : player.isViceCaptain
      ? "border-blue-400/20 bg-blue-500/10"
      : "border-white/10 bg-white/5";

  const sportAccent =
    sportAccentStyles[player.sportName] ??
    "border-white/10 bg-white/5 text-foreground/80";

  return (
    <article
      className={`rounded-2xl border p-4 shadow-[0_12px_36px_rgba(0,0,0,0.16)] transition-colors ${captainStyle}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-foreground">
            {player.name}
          </p>
          <p className="mt-1 text-sm text-foreground/60">{player.realTeam}</p>
        </div>

        <div className="flex items-center gap-2">
          {player.isCaptain ? (
            <span className="rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2 py-0.5 text-xs font-semibold text-yellow-100">
              C
            </span>
          ) : null}
          {player.isViceCaptain ? (
            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-100">
              VC
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-foreground/75">
          {player.position}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${sportAccent}`}
        >
          {player.sportDisplayName}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium text-foreground">
        Cost: {player.cost}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleStarter?.(player.playerId)}
          disabled={disabled || starterToggleDisabled}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            player.isStarter
              ? "border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15"
              : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
          } disabled:cursor-not-allowed disabled:opacity-60`}
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
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                player.isCaptain
                  ? "border-yellow-400/20 bg-yellow-500/10 text-yellow-100"
                  : "border-yellow-400/20 bg-yellow-500/10 text-yellow-100 hover:bg-yellow-500/15"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Set Captain
            </button>
            <button
              type="button"
              onClick={() => onSetViceCaptain?.(player.playerId)}
              disabled={disabled}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                player.isViceCaptain
                  ? "border-blue-400/20 bg-blue-500/10 text-blue-100"
                  : "border-blue-400/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/15"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Set Vice-Captain
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
