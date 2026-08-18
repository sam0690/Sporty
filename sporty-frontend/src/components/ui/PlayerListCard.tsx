"use client";

import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { TeamLogo } from "@/components/ui/TeamLogo";

type PlayerListCardPlayer = {
  id: string;
  name: string;
  photoUrl?: string | null;
  position: string;
  realTeam?: string;
  realTeamLogoUrl?: string | null;
  nationality?: string | null;
  flagUrl?: string | null;
  /** Shown in the meta row when set (useful in multisport pools). */
  sport?: string;
};

type PlayerListCardProps = {
  player: PlayerListCardPlayer;
  /** Omit both to render a read-only row (e.g. a staged/pending summary with
   * no safe undo action). */
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "solid" | "outline";
  className?: string;
};

export function PlayerListCard({
  player,
  actionLabel,
  onAction,
  actionVariant = "solid",
  className = "",
}: PlayerListCardProps) {
  return (
    <div
      className={`flex items-center justify-between card-surface p-3 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="sm"
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
            {player.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-3">
            <CountryFlag nationality={player.nationality} flagUrl={player.flagUrl} />
            <span>{player.position}</span>
            {player.realTeam ? (
              <>
                <span className="text-white/20">·</span>
                <TeamLogo teamName={player.realTeam} logoUrl={player.realTeamLogoUrl} size="sm" />
                <span>{player.realTeam}</span>
              </>
            ) : null}
            {player.sport ? (
              <>
                <span className="text-white/20">·</span>
                <span>{player.sport}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={`shrink-0 rounded-[3px] px-4 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] transition-colors ${
            actionVariant === "solid"
              ? "bg-accent text-black hover:bg-accent-bright"
              : "border border-accent/40 text-accent hover:bg-accent/8"
          }`}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export type { PlayerListCardPlayer };
