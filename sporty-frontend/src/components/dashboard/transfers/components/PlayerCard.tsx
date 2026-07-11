"use client";

import { Plus } from "lucide-react";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type PlayerCardProps = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  price: number;
  avgPoints: number;
  form?: number;
  photoUrl?: string | null;
  realTeam?: string;
  realTeamLogoUrl?: string | null;
  onAdd: (id: string) => void;
  animationDelay?: number;
  disabled?: boolean;
};

const sportAccentColor: Record<Exclude<Sport, "All">, string> = {
  football: "#00ff88",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
};

export function PlayerCard({
  id,
  name,
  sport,
  position,
  price,
  avgPoints,
  form,
  photoUrl,
  realTeam,
  realTeamLogoUrl,
  onAdd,
  animationDelay = 0,
  disabled = false,
}: PlayerCardProps) {
  const accent = sport === "All" ? "#71717d" : sportAccentColor[sport];

  return (
    <article
      className="card-fade-in group flex items-center gap-4 rounded-[3px] border border-white/8 bg-surface-1 p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/16 hover:bg-[#15151c]"
      style={{ animationDelay: `${animationDelay}ms`, borderLeft: `3px solid ${accent}` }}
    >
      <div className="relative shrink-0">
        <PlayerAvatar name={name} photoUrl={photoUrl} size="md" />
        <span
          className="absolute -bottom-1 -right-1 flex h-4 w-6 items-center justify-center rounded-[2px] text-[9px] font-700 uppercase tracking-[0.5px]"
          style={{ color: accent, background: "#0d0d12", border: `1px solid ${accent}55` }}
        >
          {position}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-fg-1">
          {name}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-fg-3">
          {realTeam ? (
            <>
              <TeamLogo teamName={realTeam} logoUrl={realTeamLogoUrl} size="sm" className="shrink-0" />
              <span className="truncate">{realTeam}</span>
              <span className="text-[#33333a]">·</span>
            </>
          ) : null}
          <span title="Weighted average of the last 3 gameweeks, not a prediction">
            Proj {avgPoints.toFixed(1)}
          </span>
          {form ? (
            <>
              <span className="text-[#33333a]">·</span>
              <span>Form {form}/10</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="num font-bebas text-xl leading-none tracking-[1px] text-accent">
            ${price.toFixed(1)}M
          </p>
          <p className="section-label mt-1">Cost</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(id)}
          aria-label={`Add ${name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border border-accent/40 bg-transparent text-accent transition-colors hover:bg-accent/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

export type { PlayerCardProps };
