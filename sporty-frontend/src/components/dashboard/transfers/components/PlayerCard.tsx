"use client";

import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type PlayerCardProps = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  price: number;
  avgPoints: number;
  form?: number;
  onAdd: (id: string) => void;
  animationDelay?: number;
  disabled?: boolean;
};

const sportAccentColor: Record<Exclude<Sport, "All">, string> = {
  football: "#16A34A",
  basketball: "#EA580C",
  cricket: "#0891B2",
};

const sportLabel: Record<Exclude<Sport, "All">, string> = {
  football: "Football",
  basketball: "Basketball",
  cricket: "Cricket",
};

export function PlayerCard({
  id,
  name,
  sport,
  position,
  price,
  avgPoints,
  form,
  onAdd,
  animationDelay = 0,
  disabled = false,
}: PlayerCardProps) {
  const accent = sport === "All" ? "#6B7280" : sportAccentColor[sport];
  const label = sport === "All" ? "Player" : sportLabel[sport];

  return (
    <article
      className="card-fade-in flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-3 transition-colors hover:border-[rgba(11,18,32,0.15)]"
      style={{ animationDelay: `${animationDelay}ms`, borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="grid h-11 w-14 shrink-0 place-items-center rounded-[3px] font-barlow-condensed text-xs font-bold uppercase tracking-[0.5px]"
          style={{ color: accent, background: `${accent}1f` }}
        >
          {position}
        </span>
        <div className="min-w-0">
          <p className="truncate font-barlow-condensed text-base font-bold uppercase tracking-[1px] text-[#0B1220]">
            {name}
          </p>
          <p className="mt-0.5 truncate text-xs text-[#6B7280]">
            <span style={{ color: accent }}>{label}</span>
            <span className="mx-1.5 text-[#EAECF0]">·</span>
            Proj {avgPoints.toFixed(1)}
            {form ? (
              <>
                <span className="mx-1.5 text-[#EAECF0]">·</span>Form {form}/10
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="font-bebas text-xl leading-none tracking-[1px] text-[#DC2626]">
            ${price}M
          </p>
          <p className="section-label mt-1">Cost</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(id)}
          className="rounded-[3px] border border-[rgba(220,38,38,0.4)] bg-transparent px-3.5 py-1.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#DC2626] transition-colors hover:bg-[rgba(220,38,38,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      </div>
    </article>
  );
}

export type { PlayerCardProps };
