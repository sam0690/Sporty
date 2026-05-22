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
      className="card-fade-in flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-surface/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-primary/25 hover:shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-foreground">
          👤 {name}
        </p>
        <p className="mt-1 text-sm text-slate-400">{sportLabel}</p>
      </div>

      <div className="text-right sm:min-w-27.5">
        <p className="text-sm font-semibold text-foreground">💰 ${price}M</p>
        <p className="text-xs text-slate-500">Proj: {avgPoints.toFixed(1)}</p>
        {form ? (
          <p className="text-xs text-slate-500">Form: {form}/10</p>
        ) : null}
      </div>

      <div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(id)}
          className="rounded-full border border-white/10 bg-white/6 px-3.5 py-1.5 text-sm font-medium text-slate-300 transition-all hover:-translate-y-0.5 hover:border-accent-primary/30 hover:bg-accent-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add
        </button>
      </div>
    </article>
  );
}

export type { PlayerCardProps };
