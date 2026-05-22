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
    <section className="rounded-[1.75rem] border border-white/10 bg-surface/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl animate-[fade-soft_0.2s_ease]">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        This Week&apos;s Matchup
      </h2>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">{yourTeamName}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{yourScore}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {opponentTeamName}
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {opponentScore}
          </p>
        </div>
      </div>

      {youWinning ? (
        <div className="mt-4 flex justify-center">
          <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-3 py-1 text-xs text-slate-200">
            🏆 Leading
          </span>
        </div>
      ) : null}
    </section>
  );
}
