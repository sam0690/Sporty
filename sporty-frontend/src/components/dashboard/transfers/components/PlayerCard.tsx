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
  football: "#4caf50",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
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
  const accent = sport === "All" ? "#555560" : sportAccentColor[sport];
  const label = sport === "All" ? "Player" : sportLabel[sport];

  return (
    <article
      className="card-fade-in flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-4 py-3 transition-colors hover:border-[rgba(255,255,255,0.15)]"
      style={{ animationDelay: `${animationDelay}ms`, borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="grid h-11 w-14 shrink-0 place-items-center rounded-[3px] font-barlow-condensed text-xs font-700 uppercase tracking-[0.5px]"
          style={{ color: accent, background: `${accent}1f` }}
        >
          {position}
        </span>
        <div className="min-w-0">
          <p className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            {name}
          </p>
          <p className="mt-0.5 truncate text-xs text-[#555560]">
            <span style={{ color: accent }}>{label}</span>
            <span className="mx-1.5 text-[#33333a]">·</span>
            Proj {avgPoints.toFixed(1)}
            {form ? (
              <>
                <span className="mx-1.5 text-[#33333a]">·</span>Form {form}/10
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="font-bebas text-xl leading-none tracking-[1px] text-[#e8fb25]">
            ${price.toFixed(1)}M
          </p>
          <p className="section-label mt-1">Cost</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(id)}
          className="rounded-[3px] border border-[rgba(232,251,37,0.4)] bg-transparent px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#e8fb25] transition-colors hover:bg-[rgba(232,251,37,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      </div>
    </article>
  );
}

export type { PlayerCardProps };
