"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
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
    <Card>
      <CardHeader className="flex items-center justify-between gap-4">
        <CardTitle>Gameweek Points</CardTitle>
        {rows.length > 0 && (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="font-bebas text-xl leading-none tracking-[1px] text-[#6B7280]">
                {Math.round(average)}
              </p>
              <p className="section-label mt-1">Avg</p>
            </div>
            <div className="text-right">
              <p className="font-bebas text-2xl leading-none tracking-[1px] text-[#DC2626]">
                {Math.round(total)}
              </p>
              <p className="section-label mt-1">Total</p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-[3px] bg-[#F3F4F7]"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4 text-sm text-[#6B7280]">
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
                  <span className="w-12 shrink-0 font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#6B7280]">
                    GW{row.gameweek}
                  </span>

                  <div className="relative h-7 flex-1 overflow-hidden rounded-[3px] bg-[#F3F4F7]">
                    <div
                      className="h-full rounded-[3px] transition-[width] duration-300"
                      style={{
                        width: `${Math.max(widthPct, 3)}%`,
                        background: isBest ? "#DC2626" : "rgba(220,38,38,0.28)",
                      }}
                    />
                    {row.rank != null && (
                      <span className="absolute inset-y-0 right-2 flex items-center section-label">
                        Rank #{row.rank}
                      </span>
                    )}
                  </div>

                  <span
                    className={`w-12 shrink-0 text-right font-bebas text-xl leading-none tracking-[1px] ${
                      isBest ? "text-[#DC2626]" : "text-[#0B1220]"
                    }`}
                  >
                    {Math.round(value)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
