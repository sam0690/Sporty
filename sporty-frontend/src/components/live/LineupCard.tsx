"use client";

import { useMatchStore } from "@/store/matchStore";

export function LineupCard() {
  const lineup = useMatchStore((s) => s.lineup);
  const teamIds = Object.keys(lineup);

  return (
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="text-xs uppercase tracking-wider text-[#555560]">
        Live Lineup Changes
      </div>
      <div className="mt-3 space-y-2 text-sm text-[#555560]">
        {teamIds.length === 0 && <p>No lineup changes yet.</p>}
        {teamIds.map((teamId) => (
          <div
            key={teamId}
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2"
          >
            <div className="font-medium text-[#f0f0f0]">Team {teamId}</div>
            <pre className="mt-1 overflow-x-auto text-xs text-[#555560]">
              {JSON.stringify(lineup[teamId], null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
