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
    <section className="glass rounded-xl p-5">
      <span className="section-label">Lineup Changes</span>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No lineup changes yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map(([teamId, raw]) => {
            const change = raw as LineupChange;
            return (
              <li
                key={teamId}
                className="rounded-lg border border-border bg-white/5 px-3 py-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-600 text-muted-foreground">
                    {nameFor(change.team_id ?? teamId)}
                  </span>
                  {change.minute != null && (
                    <span className="font-display text-xs font-900 tabular-nums text-football">
                      {change.minute}&apos;
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-football">
                    ▲ {nameFor(change.player_in)}
                  </span>
                  <span className="text-danger">
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
