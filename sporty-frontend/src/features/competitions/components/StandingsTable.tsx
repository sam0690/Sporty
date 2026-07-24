"use client";

import { CompetitionLogo } from "@/components/ui/CompetitionLogo";
import type { TStandingRow } from "@/types/competition";

function FormDots({ form }: { form?: string | null }) {
  if (!form) return null;
  const results = form.split(",").slice(-5);
  const color: Record<string, string> = {
    W: "bg-[oklch(0.72_0.17_150)]",
    D: "bg-fg-3",
    L: "bg-[oklch(0.63_0.2_25)]",
  };
  return (
    <div className="hidden items-center gap-1 md:flex">
      {results.map((r, i) => (
        <span
          key={i}
          title={r}
          className={`size-1.5 rounded-full ${color[r] ?? "bg-fg-3"}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function StandingsTable({ table, tag }: { table: TStandingRow[]; tag?: string }) {
  return (
    <div className="overflow-hidden card-surface">
      {tag && (
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          <CompetitionLogo tag={tag} className="size-5" />
          <p className="section-label">Standings</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left">
            <th className="px-3 py-2.5 text-right font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
              #
            </th>
            <th className="px-2 py-2.5 font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
              Club
            </th>
            {["P", "W", "D", "L", "GF", "GA", "GD"].map((h) => (
              <th
                key={h}
                className="px-2 py-2.5 text-center font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3"
              >
                {h}
              </th>
            ))}
            <th className="hidden px-2 py-2.5 text-center font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3 md:table-cell">
              Form
            </th>
            <th className="px-3 py-2.5 text-right font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-2">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => (
            <tr
              key={row.team.id}
              className="border-b border-white/6 transition-colors last:border-b-0 hover:bg-white/3"
            >
              <td className="px-3 py-2.5 text-right tabular-nums text-fg-3">
                {row.position}
              </td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2.5">
                  {row.team.crest ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.team.crest}
                      alt=""
                      className="size-5 shrink-0 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="size-5 shrink-0 rounded-full bg-surface-3" />
                  )}
                  <span className="truncate font-500 text-fg-1">
                    {row.team.name}
                  </span>
                </div>
              </td>
              {[
                row.playedGames,
                row.won,
                row.draw,
                row.lost,
                row.goalsFor,
                row.goalsAgainst,
              ].map((v, i) => (
                <td
                  key={i}
                  className="px-2 py-2.5 text-center tabular-nums text-fg-2"
                >
                  {v}
                </td>
              ))}
              <td className="px-2 py-2.5 text-center tabular-nums text-fg-2">
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              <td className="hidden px-2 py-2.5 md:table-cell">
                <div className="flex justify-center">
                  <FormDots form={row.form} />
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-700 tabular-nums text-fg-1">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
