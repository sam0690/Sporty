"use client";

import { useMemo } from "react";

import type { TGameweekPoints } from "@/types/league";

type GameweekBreakdownProps = {
  breakdown: TGameweekPoints[];
  isLoading?: boolean;
};

export function GameweekBreakdown({
  breakdown,
  isLoading,
}: GameweekBreakdownProps) {
  const { rows, maxPoints, total, best } = useMemo(() => {
    const sorted = [...breakdown].sort((a, b) => a.gameweek - b.gameweek);
    const max = sorted.reduce((m, r) => Math.max(m, Number(r.points)), 0);
    const sum = sorted.reduce((s, r) => s + Number(r.points), 0);
    const bestGw = sorted.reduce<TGameweekPoints | null>(
      (acc, r) => (acc === null || Number(r.points) > Number(acc.points) ? r : acc),
      null,
    );
    return { rows: sorted, maxPoints: max, total: sum, best: bestGw };
  }, [breakdown]);

  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="section-label">Gameweek Points</p>
          <p className="mt-1 text-sm text-[#555560]">
            Points your team scored each gameweek
          </p>
        </div>
        <div className="text-right">
          <p className="font-bebas text-3xl leading-none tracking-[2px] text-[#e8fb25]">
            {Math.round(total)}
          </p>
          <p className="section-label mt-1">Total</p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-[#555560]">Loading gameweek points…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-[#555560]">
          No gameweeks scored yet. Points appear here once a gameweek finishes.
        </p>
      ) : (
        <div className="mt-6 flex items-end gap-2 overflow-x-auto pb-1">
          {rows.map((row) => {
            const value = Number(row.points);
            const heightPct = maxPoints > 0 ? (value / maxPoints) * 100 : 0;
            const isBest = best != null && row.gameweek === best.gameweek;
            return (
              <div
                key={row.transfer_window_id}
                className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-2"
                title={`Gameweek ${row.gameweek}: ${value} pts${
                  row.rank ? ` · rank #${row.rank}` : ""
                }`}
              >
                <span
                  className={`font-bebas text-sm leading-none tracking-[1px] ${
                    isBest ? "text-[#e8fb25]" : "text-[#9a9aa5]"
                  }`}
                >
                  {Math.round(value)}
                </span>
                <div className="flex h-28 w-full items-end">
                  <div
                    className="w-full rounded-t-[2px] transition-[height] duration-300"
                    style={{
                      height: `${Math.max(heightPct, 4)}%`,
                      background: isBest
                        ? "#e8fb25"
                        : "rgba(232,251,37,0.32)",
                    }}
                  />
                </div>
                <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#555560]">
                  GW{row.gameweek}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
