"use client";

import { useMatchStore } from "@/store/matchStore";

export function LineupCard() {
  const lineup = useMatchStore((s) => s.lineup);
  const teamIds = Object.keys(lineup);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="text-xs uppercase tracking-wider text-foreground/55">
        Live Lineup Changes
      </div>
      <div className="mt-3 space-y-2 text-sm text-foreground/70">
        {teamIds.length === 0 && <p>No lineup changes yet.</p>}
        {teamIds.map((teamId) => (
          <div
            key={teamId}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
          >
            <div className="font-medium text-foreground">Team {teamId}</div>
            <pre className="mt-1 overflow-x-auto text-xs text-foreground/55">
              {JSON.stringify(lineup[teamId], null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
