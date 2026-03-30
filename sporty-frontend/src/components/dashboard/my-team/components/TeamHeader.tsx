"use client";

type TeamHeaderProps = {
  totalPlayers: number;
  totalPoints: number;
  avgPointsPerGame: number;
};

export function TeamHeader({
  totalPlayers,
  totalPoints,
  avgPointsPerGame,
}: TeamHeaderProps) {
  return (
    <header className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary">My Team</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
          <p className="text-2xl font-bold text-primary-600">{totalPlayers}</p>
          <p className="text-sm text-text-secondary">Total Players</p>
        </div>

        <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
          <p className="text-2xl font-bold text-primary-600">{totalPoints}</p>
          <p className="text-sm text-text-secondary">Total Points</p>
        </div>

        <div className="rounded-lg bg-surface-100 p-4 text-center shadow-card">
          <p className="text-2xl font-bold text-primary-600">{avgPointsPerGame.toFixed(1)}</p>
          <p className="text-sm text-text-secondary">Avg Points/Game</p>
        </div>
      </div>
    </header>
  );
}
