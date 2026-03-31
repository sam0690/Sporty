"use client";

type CurrentMatchupProps = {
  yourTeamName: string;
  yourScore: number;
  opponentTeamName: string;
  opponentScore: number;
};

export function CurrentMatchup({
  yourTeamName,
  yourScore,
  opponentTeamName,
  opponentScore,
}: CurrentMatchupProps) {
  const youWinning = yourScore >= opponentScore;

  return (
    <section className="rounded-lg bg-surface-100 p-6 shadow-card">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">This Week's Matchup</h2>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-sm text-text-secondary">{yourTeamName}</p>
          <p className={`mt-2 text-3xl font-bold ${youWinning ? "text-primary-600" : "text-text-primary"}`}>
            {yourScore}
          </p>
        </div>
        <div>
          <p className="text-sm text-text-secondary">{opponentTeamName}</p>
          <p className={`mt-2 text-3xl font-bold ${youWinning ? "text-text-primary" : "text-primary-600"}`}>
            {opponentScore}
          </p>
        </div>
      </div>
    </section>
  );
}
