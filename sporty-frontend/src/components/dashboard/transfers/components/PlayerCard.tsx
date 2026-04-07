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
}: PlayerCardProps) {
  const sportLabel =
    sport === "All" ? "🏟️" : `${sportIcons[sport]} ${position}`;

  return (
    <article
      className="card-fade-in flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 hover:border-gray-200 hover:shadow-sm"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-gray-900">
          👤 {name}
        </p>
        <p className="mt-1 text-sm text-gray-500">{sportLabel}</p>
      </div>

      <div className="text-right sm:min-w-27.5">
        <p className="text-sm font-semibold text-gray-900">💰 ${price}M</p>
        <p className="text-xs text-gray-400">Proj: {avgPoints.toFixed(1)}</p>
        {form ? <p className="text-xs text-gray-400">Form: {form}/10</p> : null}
      </div>

      <div>
        <button
          type="button"
          onClick={() => onAdd(id)}
          className="rounded-full border border-gray-300 px-3.5 py-1.5 text-sm text-gray-600 transition-colors hover:border-primary-500 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      </div>
    </article>
  );
}

export type { PlayerCardProps };
