"use client";

import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type PlayerCardProps = {
  id: number;
  name: string;
  sport: Sport;
  position: string;
  price: number;
  avgPoints: number;
  form?: number;
  onAdd: (id: number) => void;
};

const sportBadgeStyles: Record<Exclude<Sport, "All">, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
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
}: PlayerCardProps) {
  const badgeClass =
    sport === "All"
      ? "bg-surface-200 text-text-secondary"
      : sportBadgeStyles[sport];

  return (
    <article className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface-100 p-4 transition-all hover:border-primary-200 hover:shadow-card-hover">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-text-primary">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 font-medium capitalize ${badgeClass}`}>
            {sport}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-text-secondary">
            {position}
          </span>
          {form ? (
            <span className="text-text-secondary">Form {form}/10</span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-text-secondary">Avg points: {avgPoints.toFixed(1)}</p>
      </div>

      <div className="text-right">
        <p className="text-lg font-bold text-primary-600">
          <span aria-hidden="true">$</span>
          {price}M
        </p>
        <button
          type="button"
          onClick={() => onAdd(id)}
          className="mt-2 rounded-lg bg-primary-500 px-3 py-2 text-sm text-white transition-colors hover:bg-primary-600"
        >
          Transfer In
        </button>
      </div>
    </article>
  );
}

export type { PlayerCardProps };
