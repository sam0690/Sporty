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

const sportIcons: Record<Exclude<Sport, "All">, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
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
  const sportLabel =
    sport === "All" ? "🏟️" : `${sportIcons[sport]} ${position}`;

  return (
    <article
      className="card-fade-in flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4 transition-colors hover:border-[rgba(255,255,255,0.15)]"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base text-[#f0f0f0]">
          👤 {name}
        </p>
        <p className="mt-1 text-sm text-[#555560]">{sportLabel}</p>
      </div>

      <div className="text-right sm:min-w-27.5">
        <p className="text-sm font-600 text-[#f0f0f0]">💰 ${price}M</p>
        <p className="text-xs text-[#555560]">Proj: {avgPoints.toFixed(1)}</p>
        {form ? (
          <p className="text-xs text-[#555560]">Form: {form}/10</p>
        ) : null}
      </div>

      <div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(id)}
          className="rounded-[3px] border border-[rgba(232,251,37,0.4)] bg-transparent px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#e8fb25] transition-colors hover:bg-[rgba(232,251,37,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      </div>
    </article>
  );
}

export type { PlayerCardProps };
