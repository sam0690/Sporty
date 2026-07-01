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
      <section className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-5 text-center animate-fade-soft">
        <p className="section-label mb-4">This Week</p>
        <p className="truncate font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#0B1220]">
          {yourTeamName}
        </p>
        <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#DC2626]">
          {yourScore}
        </p>
        <p className="section-label mt-1">Your Points</p>
        <div className="mt-4 flex justify-center">
          <span
            className={
              isLeadingSolo
                ? "rounded-[3px] border border-[rgba(220,38,38,0.25)] bg-[#FEE2E2] px-3 py-1 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#B91C1C]"
                : "rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-3 py-1 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280]"
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
    <section className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-5 animate-fade-soft">
      <p className="section-label mb-4">
        {youAreLeader ? "You vs Runner-Up" : "You vs Leader"}
      </p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center">
          <p className="truncate font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#0B1220]">
            {yourTeamName}
          </p>
          <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#DC2626]">
            {yourScore}
          </p>
          <p className="section-label mt-1">You</p>
        </div>

        <span className="font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280]">
          VS
        </span>

        <div className="text-center">
          <p className="truncate font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#0B1220]">
            {opponentTeamName || "—"}
          </p>
          <p className="mt-2 font-bebas text-5xl tracking-[2px] text-[#6B7280]">
            {opponentScore}
          </p>
          <p className="section-label mt-1">
            {youAreLeader ? "Runner-Up" : "Leader"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        {youAreLeader && leading ? (
          <span className="rounded-[3px] border border-[rgba(220,38,38,0.25)] bg-[#FEE2E2] px-3 py-1 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#B91C1C]">
            Top of the league
          </span>
        ) : leading ? (
          <span className="rounded-[3px] border border-[rgba(220,38,38,0.25)] bg-[#FEE2E2] px-3 py-1 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#B91C1C]">
            Ahead by {Math.abs(diff)} this week
          </span>
        ) : (
          <span className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-3 py-1 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280]">
            {Math.abs(diff)} behind the leader
          </span>
        )}
      </div>
    </section>
  );
}
