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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 animate-fade-soft">
      <p className="section-label mb-4">This Week&apos;s Matchup</p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center">
          <p className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#f0f0f0] truncate">
            {yourTeamName}
          </p>
          <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#e8fb25]">
            {yourScore}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560]">VS</span>
        </div>

        <div className="text-center">
          <p className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#f0f0f0] truncate">
            {opponentTeamName}
          </p>
          <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#555560]">
            {opponentScore}
          </p>
        </div>
      </div>

      {youWinning ? (
        <div className="mt-4 flex justify-center">
          <span className="rounded-[3px] border border-[rgba(232,251,37,0.25)] bg-[#1a1a10] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#c8d85a]">
            Leading
          </span>
        </div>
      ) : null}
    </section>
  );
}
