"use client";

import { useMatchStore } from "@/store/matchStore";
import type { LineupChange } from "@/types/events";

export function LineupCard() {
  const lineup = useMatchStore((s) => s.lineup);
  const players = useMatchStore((s) => s.players);
  const entries = Object.entries(lineup);

  const nameFor = (id: string | undefined) =>
    (id && players[id]?.name) || id || "—";

  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <span className="section-label">Lineup Changes</span>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[#555560]">No lineup changes yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map(([teamId, raw]) => {
            const change = raw as LineupChange;
            return (
              <li
                key={teamId}
                className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#9a9aa5]">
                    {nameFor(change.team_id ?? teamId)}
                  </span>
                  {change.minute != null && (
                    <span className="font-bebas text-sm leading-none tracking-[1px] text-[#e8fb25]">
                      {change.minute}&apos;
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-[#e8fb25]">▲ {nameFor(change.player_in)}</span>
                  <span className="text-[#ff3b5c]">
                    ▼ {nameFor(change.player_out)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
