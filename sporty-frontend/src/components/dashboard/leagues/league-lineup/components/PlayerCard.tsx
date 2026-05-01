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
  football: "border-accent-football/30 bg-accent-football/5",
  basketball: "border-accent-basketball/30 bg-accent-basketball/5",
  cricket: "border-accent-cricket/30 bg-accent-cricket/5",
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
    ? "border-yellow-300 bg-yellow-50"
    : player.isViceCaptain
      ? "border-blue-300 bg-primary/5"
      : "border-accent/20 bg-white";

  const sportAccent =
    sportAccentStyles[player.sportName] ?? "border-border bg-[#F4F4F9]";

  return (
    <article
      className={`rounded-md border p-4 shadow-sm transition-colors ${captainStyle}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-black">{player.name}</p>
          <p className="mt-1 text-sm text-secondary">{player.realTeam}</p>
        </div>

        <div className="flex items-center gap-2">
          {player.isCaptain ? (
            <span className="rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
              C
            </span>
          ) : null}
          {player.isViceCaptain ? (
            <span className="rounded-full border border-blue-300 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-blue-800">
              VC
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-[#F4F4F9] px-2.5 py-1 text-xs font-medium text-black">
          {player.position}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium text-black ${sportAccent}`}
        >
          {player.sportDisplayName}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium text-black">
        Cost: {player.cost}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleStarter?.(player.playerId)}
          disabled={disabled || starterToggleDisabled}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            player.isStarter
              ? "border-danger/20 bg-danger/5 text-danger hover:bg-danger/10"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
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
                  ? "border-yellow-300 bg-yellow-100 text-yellow-800"
                  : "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
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
                  ? "border-blue-300 bg-primary/10 text-blue-800"
                  : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
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
