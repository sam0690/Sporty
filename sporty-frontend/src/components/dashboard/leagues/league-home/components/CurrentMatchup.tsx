"use client";

type CurrentMatchupProps = {
  yourTeamName: string;
  yourScore: number;
  // The team you're chasing (the league leader). When you ARE the leader this
  // is the runner-up, and youAreLeader flips the framing.
  opponentTeamName: string;
  opponentScore: number;
  youAreLeader?: boolean;
  // False when there's no one to compare against — a solo leader with no
  // runner-up, or a gameweek nobody has been scored in yet.
  hasOpponent?: boolean;
};

export function CurrentMatchup({
  yourTeamName,
  yourScore,
  opponentTeamName,
  opponentScore,
  youAreLeader = false,
  hasOpponent = true,
}: CurrentMatchupProps) {
  // No one to compare against: either you're the only scored team (solo
  // leader) or the gameweek hasn't been scored yet. Show a single-team state
  // instead of a "vs —" matchup against a phantom 0.
  if (!hasOpponent) {
    const isLeadingSolo = youAreLeader || yourScore > 0;
    return (
      <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 text-center animate-fade-soft">
        <p className="section-label mb-4">This Week</p>
        <p className="truncate font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#f0f0f0]">
          {yourTeamName}
        </p>
        <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#e8fb25]">
          {yourScore}
        </p>
        <p className="section-label mt-1">Your Points</p>
        <div className="mt-4 flex justify-center">
          <span
            className={
              isLeadingSolo
                ? "rounded-[3px] border border-[rgba(232,251,37,0.25)] bg-[#1a1a10] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#c8d85a]"
                : "rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5]"
            }
          >
            {isLeadingSolo ? "Top of the league · no challengers yet" : "No scores yet this week"}
          </span>
        </div>
      </section>
    );
  }

  // Positive = you're ahead of the team you're compared against.
  const diff = yourScore - opponentScore;
  const leading = diff >= 0;

  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 animate-fade-soft">
      <p className="section-label mb-4">
        {youAreLeader ? "You vs Runner-Up" : "You vs Leader"}
      </p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center">
          <p className="truncate font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            {yourTeamName}
          </p>
          <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#e8fb25]">
            {yourScore}
          </p>
          <p className="section-label mt-1">You</p>
        </div>

        <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560]">
          VS
        </span>

        <div className="text-center">
          <p className="truncate font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            {opponentTeamName || "—"}
          </p>
          <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#555560]">
            {opponentScore}
          </p>
          <p className="section-label mt-1">
            {youAreLeader ? "Runner-Up" : "Leader"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        {youAreLeader && leading ? (
          <span className="rounded-[3px] border border-[rgba(232,251,37,0.25)] bg-[#1a1a10] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#c8d85a]">
            Top of the league
          </span>
        ) : leading ? (
          <span className="rounded-[3px] border border-[rgba(232,251,37,0.25)] bg-[#1a1a10] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#c8d85a]">
            Ahead by {Math.abs(diff)} this week
          </span>
        ) : (
          <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5]">
            {Math.abs(diff)} behind the leader
          </span>
        )}
      </div>
    </section>
  );
}
