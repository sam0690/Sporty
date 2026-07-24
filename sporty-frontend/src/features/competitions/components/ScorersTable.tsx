"use client";

import { CompetitionLogo } from "@/components/ui/CompetitionLogo";
import type { TScorer } from "@/types/competition";

export function ScorersTable({ scorers, tag }: { scorers: TScorer[]; tag?: string }) {
  return (
    <div className="overflow-hidden card-surface">
      {tag && (
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          <CompetitionLogo tag={tag} className="size-5" />
          <p className="section-label">Top Scorers</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left">
            <th className="px-3 py-2.5 text-right font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
              #
            </th>
            <th className="px-2 py-2.5 font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
              Player
            </th>
            <th className="px-2 py-2.5 text-center font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
              A
            </th>
            <th className="hidden px-2 py-2.5 text-center font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3 sm:table-cell">
              Pens
            </th>
            <th className="px-3 py-2.5 text-right font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-2">
              Goals
            </th>
          </tr>
        </thead>
        <tbody>
          {scorers.map((s, i) => (
            <tr
              key={s.player.id}
              className="border-b border-white/6 transition-colors last:border-b-0 hover:bg-white/3"
            >
              <td className="px-3 py-2.5 text-right tabular-nums text-fg-3">
                {i + 1}
              </td>
              <td className="px-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-500 text-fg-1">{s.player.name}</p>
                  <p className="truncate text-xs text-fg-3">{s.team.name}</p>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums text-fg-2">
                {s.assists ?? 0}
              </td>
              <td className="hidden px-2 py-2.5 text-center tabular-nums text-fg-2 sm:table-cell">
                {s.penalties ?? 0}
              </td>
              <td className="px-3 py-2.5 text-right font-700 tabular-nums text-fg-1">
                {s.goals ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
