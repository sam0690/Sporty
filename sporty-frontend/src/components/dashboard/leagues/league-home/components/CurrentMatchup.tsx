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
    <section className="rounded-2xl border border-gray-100 bg-white p-5 [animation:fade-soft_0.2s_ease]">
      <h2 className="mb-4 text-sm font-medium text-gray-500">This Week's Matchup</h2>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-sm font-medium text-gray-900">{yourTeamName}</p>
          <p className="mt-2 text-2xl font-light text-gray-900">
            {yourScore}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{opponentTeamName}</p>
          <p className="mt-2 text-2xl font-light text-gray-900">
            {opponentScore}
          </p>
        </div>
      </div>

      {youWinning ? (
        <div className="mt-4 flex justify-center">
          <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1 text-xs text-gray-600">
            🏆 Leading
          </span>
        </div>
      ) : null}
    </section>
  );
}
