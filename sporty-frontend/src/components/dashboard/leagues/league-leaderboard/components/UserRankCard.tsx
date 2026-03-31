"use client";

type UserRankCardProps = {
  rank: number;
  teamName: string;
  totalPoints: number;
  wins: number;
  losses: number;
  pointsBehind: number;
};

function rankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🏅";
}

export function UserRankCard({ rank, teamName, totalPoints, wins, losses, pointsBehind }: UserRankCardProps) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
      <div>
        <p className="text-sm text-text-secondary">Your Position</p>
        <p className="mt-1 text-2xl font-semibold text-text-primary">{rankMedal(rank)} #{rank}</p>
        <p className="mt-1 text-sm text-text-secondary">{teamName}</p>
      </div>

      <div className="text-right">
        <p className="text-lg font-semibold text-primary-600">{totalPoints} pts</p>
        <p className="text-sm text-text-secondary">Record: {wins}-{losses}</p>
        {rank > 1 ? <p className="text-xs text-text-secondary">{pointsBehind} pts behind leader</p> : null}
      </div>
    </section>
  );
}
