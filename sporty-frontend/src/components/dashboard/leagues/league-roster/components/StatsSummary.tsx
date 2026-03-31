"use client";

type BestPlayer = {
  name: string;
  points: number;
};

type StatsSummaryProps = {
  totalPoints: number;
  avgPointsPerGame: number;
  bestPlayer: BestPlayer;
  totalPlayers: number;
};

export function StatsSummary({ totalPoints, avgPointsPerGame, bestPlayer, totalPlayers }: StatsSummaryProps) {
  return (
    <section className="grid grid-cols-3 gap-4">
      <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
        <p className="text-2xl font-bold text-primary-600">{totalPoints}</p>
        <p className="text-sm text-text-secondary">Total Points ({totalPlayers} players)</p>
      </div>

      <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
        <p className="text-2xl font-bold text-primary-600">{avgPointsPerGame.toFixed(1)}</p>
        <p className="text-sm text-text-secondary">Avg Points/Game</p>
      </div>

      <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
        <p className="text-xl font-bold text-primary-600">{bestPlayer.name}</p>
        <p className="text-sm text-text-secondary">Best Player ({bestPlayer.points} pts)</p>
      </div>
    </section>
  );
}
