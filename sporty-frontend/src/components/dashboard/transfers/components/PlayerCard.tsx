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
      className="card-fade-in flex flex-wrap items-center justify-between gap-4 rounded-md border border-accent/20 bg-white p-4 transition-all duration-200 hover:border-border hover:shadow-sm"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-black">
          👤 {name}
        </p>
        <p className="mt-1 text-sm text-secondary">{sportLabel}</p>
      </div>

      <div className="text-right sm:min-w-27.5">
        <p className="text-sm font-semibold text-black">💰 ${price}M</p>
        <p className="text-xs text-secondary/60">Proj: {avgPoints.toFixed(1)}</p>
        {form ? <p className="text-xs text-secondary/60">Form: {form}/10</p> : null}
      </div>

      <div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(id)}
          className="rounded-full border border-border px-3.5 py-1.5 text-sm text-secondary transition-colors hover:border-primary-500 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      </div>
    </article>
  );
}

export type { PlayerCardProps };
