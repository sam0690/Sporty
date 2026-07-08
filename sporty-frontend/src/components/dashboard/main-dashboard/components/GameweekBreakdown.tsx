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
    <section className="overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#121218] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_18px_40px_-26px_rgba(0,0,0,0.9)]">
      <header className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
        <h2 className="font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-[#d7d7de]">
          Gameweek Points
        </h2>
        {rows.length > 0 && (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="num font-bebas text-xl leading-none tracking-[1px] text-[#9a9aa5]">
                {Math.round(average)}
              </p>
              <p className="section-label mt-1">Avg</p>
            </div>
            <div className="text-right">
              <p className="num font-bebas text-2xl leading-none tracking-[1px] text-[#e8fb25]">
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
              <div key={index} className="skeleton h-10 rounded-[8px]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#1a1a22] p-4 text-sm text-[#777783]">
            No gameweeks scored yet. Points appear here once a gameweek finishes.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row) => {
              const value = Number(row.points);
              const widthPct = maxPoints > 0 ? (value / maxPoints) * 100 : 0;
              const isBest =
                best != null && rows.length > 1 && row.gameweek === best.gameweek;
              return (
                <li
                  key={row.transfer_window_id}
                  className="flex items-center gap-3"
                >
                  <span className="w-12 shrink-0 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#9a9aa5]">
                    GW{row.gameweek}
                  </span>

                  <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-[#1a1a22]">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${Math.max(widthPct, 3)}%`,
                        background: isBest
                          ? "linear-gradient(90deg, #e8fb25, #c8d85a)"
                          : "rgba(232,251,37,0.25)",
                        boxShadow: isBest
                          ? "0 0 16px -2px rgba(232,251,37,0.55)"
                          : "none",
                      }}
                    />
                    {row.rank != null && (
                      <span className="absolute inset-y-0 right-2.5 flex items-center section-label text-[#f0f0f0]/70">
                        Rank #{row.rank}
                      </span>
                    )}
                  </div>

                  <span
                    className={`num w-12 shrink-0 text-right font-bebas text-xl leading-none tracking-[1px] ${
                      isBest ? "text-[#e8fb25]" : "text-[#f0f0f0]"
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
