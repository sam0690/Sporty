"use client";

type Standing = {
  rank: number;
  teamId: string;
  teamName: string;
  points: number;
  wins: number;
  losses: number;
};

type StandingsTableProps = {
  standings: Standing[];
  userTeamId: string;
};

function rankClass(rank: number): string {
  if (rank === 1) {
    return "text-yellow-300";
  }

  if (rank === 2) {
    return "text-slate-300";
  }

  if (rank === 3) {
    return "text-slate-400";
  }

  return "text-foreground";
}

function rankLabel(rank: number): string {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return String(rank);
}

export function StandingsTable({ standings, userTeamId }: StandingsTableProps) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-surface/75 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl [animation:fade-soft_0.2s_ease]">
      <h2 className="p-5 pb-0 text-md font-semibold text-foreground">
        Standings
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-white/5">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Rank
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Team
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Points
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                W-L
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => {
              const isUser = team.teamId === userTeamId;

              return (
                <tr
                  key={team.teamId}
                  className={`border-b border-white/8 text-sm transition-colors hover:bg-white/5 ${isUser ? "bg-accent-primary/10" : ""}`}
                >
                  <td
                    className={`px-5 py-3 font-medium ${rankClass(team.rank)}`}
                  >
                    {rankLabel(team.rank)}
                  </td>
                  <td className="px-5 py-3 text-foreground">{team.teamName}</td>
                  <td className="px-5 py-3 text-foreground">{team.points}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {team.wins}-{team.losses}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type { Standing };
