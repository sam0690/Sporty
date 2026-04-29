"use client";

import { useMatchStore } from "@/store/matchStore";

export function LineupCard() {
  const lineup = useMatchStore((s) => s.lineup);
  const teamIds = Object.keys(lineup);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        Live Lineup Changes
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        {teamIds.length === 0 && <p>No lineup changes yet.</p>}
        {teamIds.map((teamId) => (
          <div key={teamId} className="rounded-md bg-slate-50 px-3 py-2">
            <div className="font-medium text-slate-900">Team {teamId}</div>
            <pre className="mt-1 overflow-x-auto text-xs text-slate-600">
              {JSON.stringify(lineup[teamId], null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
