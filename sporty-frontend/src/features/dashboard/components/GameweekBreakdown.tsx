"use client";

import { useMemo } from "react";
import { MinusCircle } from "lucide-react";
import { Tooltip } from "@mantine/core";

import { ErrorState } from "@/components/ui";
import type { TGameweekPoints } from "@/types/league";

type GameweekBreakdownProps = {
  breakdown: TGameweekPoints[];
  isLoading?: boolean;
  isError?: boolean;
};

export function GameweekBreakdown({
  breakdown,
  isLoading,
  isError,
}: GameweekBreakdownProps) {
  const { rows, maxPoints, total, best, average } = useMemo(() => {
    const sorted = [...breakdown].sort((a, b) => a.gameweek - b.gameweek);
    const max = sorted.reduce((m, r) => Math.max(m, Number(r.points)), 0);
    const sum = sorted.reduce((s, r) => s + Number(r.points), 0);
    const bestGw = sorted.reduce<TGameweekPoints | null>(
      (acc, r) =>
        acc === null || Number(r.points) > Number(acc.points) ? r : acc,
      null,
    );
    const avg = sorted.length ? sum / sorted.length : 0;
    return { rows: sorted, maxPoints: max, total: sum, best: bestGw, average: avg };
  }, [breakdown]);

  return (
    <section className="overflow-hidden card-surface" aria-busy={isLoading}>
      <header className="flex items-center justify-between gap-4 border-b border-white/7 px-5 py-4">
        <h2 className="font-sans text-sm font-700 uppercase tracking-[2px] text-fg-1">
          Gameweek Points
        </h2>
        {rows.length > 0 && (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="num font-display text-xl leading-none tracking-[-0.02em] text-fg-2">
                {Math.round(average)}
              </p>
              <p className="section-label mt-1">Avg</p>
            </div>
            <div className="text-right">
              <p className="num font-display text-2xl leading-none tracking-[-0.02em] text-accent">
                {Math.round(total)}
              </p>
              <p className="section-label mt-1">Total</p>
            </div>
          </div>
        )}
      </header>

      <div className="p-5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="skeleton h-10 rounded-[3px]" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load gameweek points" />
        ) : rows.length === 0 ? (
          <div className="rounded-[3px] border border-white/8 bg-surface-2 p-4 text-sm text-fg-2">
            No gameweeks scored yet. Points appear here once a gameweek finishes.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row) => {
              const value = Number(row.points);
              const deducted = Number(row.points_deducted);
              const widthPct = maxPoints > 0 ? (value / maxPoints) * 100 : 0;
              const isBest =
                best != null && rows.length > 1 && row.gameweek === best.gameweek;
              return (
                <li
                  key={row.transfer_window_id}
                  className="flex items-center gap-3"
                >
                  <span className="w-12 shrink-0 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2">
                    GW{row.gameweek}
                  </span>

                  <div className="relative h-7 flex-1 overflow-hidden rounded-[3px] bg-surface-2">
                    <div
                      aria-hidden
                      className="h-full rounded-[3px] transition-[width] duration-300"
                      style={{
                        width: `${Math.max(widthPct, 3)}%`,
                        background: isBest
                          ? "var(--accent)"
                          : "color-mix(in oklab, var(--accent) 25%, transparent)",
                      }}
                    />
                    {row.rank != null && (
                      <span className="absolute inset-y-0 right-2.5 flex items-center section-label text-fg-1/70">
                        Rank #{row.rank}
                      </span>
                    )}
                  </div>

                  {deducted > 0 && (
                    <Tooltip
                      label={`${deducted.toFixed(1)} pts deducted this window`}
                      withArrow
                    >
                      <MinusCircle
                        className="h-3.5 w-3.5 shrink-0 text-danger"
                        aria-label={`${deducted.toFixed(1)} points deducted this window`}
                      />
                    </Tooltip>
                  )}

                  <span
                    className={`num w-12 shrink-0 text-right font-display text-xl leading-none tracking-[-0.02em] ${
                      isBest ? "text-accent" : "text-fg-1"
                    }`}
                  >
                    {Math.round(value)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
