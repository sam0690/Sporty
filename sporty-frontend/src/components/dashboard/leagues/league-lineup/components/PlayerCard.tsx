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
  football: "#16A34A",
  basketball: "#EA580C",
  cricket: "#0891B2",
};

export function PlayerCard({
  player,
  onToggleStarter,
  onSetCaptain,
  onSetViceCaptain,
  starterToggleDisabled = false,
  disabled = false,
}: PlayerCardProps) {
  const accentColor = sportAccentColor[player.sportName] ?? "#6B7280";

  return (
    <article
      style={{ borderLeft: `3px solid ${accentColor}` }}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-3 transition-colors hover:border-[rgba(11,18,32,0.15)]"
    >
      {/* Identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="grid h-11 w-14 shrink-0 place-items-center rounded-[3px] font-barlow-condensed text-xs font-bold uppercase tracking-[0.5px]"
          style={{ color: accentColor, background: `${accentColor}1f` }}
        >
          {player.position}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-barlow-condensed text-base font-bold uppercase tracking-[1px] text-[#0B1220]">
              {player.name}
            </p>
            {player.isCaptain ? (
              <span className="shrink-0 rounded-[3px] border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] text-[#DC2626]">
                C
              </span>
            ) : null}
            {player.isViceCaptain ? (
              <span className="shrink-0 rounded-[3px] border border-[rgba(11,18,32,0.15)] bg-[#F3F4F7] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] text-[#0B1220]">
                VC
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-[#6B7280]">
            {player.realTeam}
            <span className="mx-1.5 text-[#EAECF0]">·</span>
            <span style={{ color: accentColor }}>{player.sportDisplayName}</span>
            <span className="mx-1.5 text-[#EAECF0]">·</span>${player.cost}
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
              className={`rounded-[3px] border px-3 py-1.5 font-barlow-condensed text-[11px] font-bold uppercase tracking-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                player.isCaptain
                  ? "border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.12)] text-[#DC2626]"
                  : "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280] hover:text-[#DC2626]"
              }`}
            >
              {player.isCaptain ? "Captain" : "Set C"}
            </button>
            <button
              type="button"
              onClick={() => onSetViceCaptain?.(player.playerId)}
              disabled={disabled}
              className={`rounded-[3px] border px-3 py-1.5 font-barlow-condensed text-[11px] font-bold uppercase tracking-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                player.isViceCaptain
                  ? "border-[rgba(11,18,32,0.25)] bg-[#F3F4F7] text-[#0B1220]"
                  : "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280] hover:text-[#0B1220]"
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
          className={`rounded-[3px] border px-3.5 py-1.5 font-barlow-condensed text-[11px] font-bold uppercase tracking-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            player.isStarter
              ? "border-[rgba(255,59,48,0.3)] bg-[rgba(255,59,48,0.08)] text-[#DC2626] hover:bg-[rgba(255,59,48,0.16)]"
              : starterToggleDisabled
                ? "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280]"
                : "border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.1)] text-[#16A34A] hover:bg-[rgba(76,175,80,0.2)]"
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
