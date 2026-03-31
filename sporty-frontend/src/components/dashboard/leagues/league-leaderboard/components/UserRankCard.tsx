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
  return `#${rank}`;
}

export function UserRankCard({ rank, teamName, totalPoints, wins, losses, pointsBehind }: UserRankCardProps) {
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary-100 bg-primary-50 p-5 [animation:fade-soft_0.2s_ease]">
      <div>
        <p className="text-sm font-medium text-primary-700">Your Position</p>
        <p className="mt-1 text-2xl font-light text-primary-900">{rankMedal(rank)}</p>
        <p className="mt-1 text-lg font-medium text-gray-900">{teamName}</p>
      </div>

      <div className="text-right">
        <p className="text-2xl font-light text-gray-900">{totalPoints}</p>
        <p className="text-sm text-gray-600">Record: {wins}-{losses}</p>
        {rank > 1 ? <p className="text-xs text-primary-600">{pointsBehind} pts behind leader</p> : null}
      </div>
    </section>
  );
}
