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
    <section className="mb-8 grid grid-cols-3 gap-4">
      <div className="text-center">
        <p className="text-lg font-medium text-black">{totalPoints}</p>
        <p className="text-sm text-secondary">Total Points ({totalPlayers} players)</p>
      </div>

      <div className="text-center">
        <p className="text-lg font-medium text-black">{avgPointsPerGame.toFixed(1)}</p>
        <p className="text-sm text-secondary">Avg Points/Game</p>
      </div>

      <div className="text-center">
        <p className="text-lg font-medium text-black">{bestPlayer.name}</p>
        <p className="text-sm text-secondary">Best Player ({bestPlayer.points} pts)</p>
      </div>
    </section>
  );
}
