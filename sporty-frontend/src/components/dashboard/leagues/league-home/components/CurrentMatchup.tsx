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
    <section className="rounded-lg border border-accent/20 bg-white p-5 [animation:fade-soft_0.2s_ease]">
      <h2 className="mb-4 text-sm font-medium text-secondary">This Week's Matchup</h2>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-sm font-medium text-black">{yourTeamName}</p>
          <p className="mt-2 text-2xl font-bold text-black">
            {yourScore}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-black">{opponentTeamName}</p>
          <p className="mt-2 text-2xl font-bold text-black">
            {opponentScore}
          </p>
        </div>
      </div>

      {youWinning ? (
        <div className="mt-4 flex justify-center">
          <span className="rounded-full border border-accent/20 bg-[#F4F4F9] px-3 py-1 text-xs text-secondary">
            🏆 Leading
          </span>
        </div>
      ) : null}
    </section>
  );
}
