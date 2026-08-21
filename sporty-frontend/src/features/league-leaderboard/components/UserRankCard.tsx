"use client";

type UserRankCardProps = {
  rank: number | null;
  teamName: string;
  totalPoints: number;
  pointsBehind: number;
  /** Points paid via the budget-overage penalty, for this scope (window or season). */
  pointsDeducted?: number;
  /**
   * Why this manager isn't scoring yet, if they aren't. Shown in place of the
   * "behind leader" line so a legitimate zero reads as an explanation rather
   * than a bug.
   */
  notScoringNote?: string;
};

export function UserRankCard({
  rank,
  teamName,
  totalPoints,
  pointsBehind,
  pointsDeducted = 0,
  notScoringNote,
}: UserRankCardProps) {
  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-accent/20 bg-accent/4 p-5 animate-fade-soft">
      <div>
        <p className="section-label">Your Position</p>
        <p className="mt-1 font-display text-6xl tracking-[-0.02em] text-accent">
          {rank === null ? "—" : `#${rank}`}
        </p>
        <p className="mt-1 font-sans text-sm font-700 uppercase tracking-[1px] text-fg-1">
          {teamName}
        </p>
      </div>

      <div className="text-right">
        <p className="font-display text-5xl tracking-[-0.02em] text-accent">
          {totalPoints}
        </p>
        <p className="section-label">Total Points</p>
        {notScoringNote ? (
          <p className="mt-1 max-w-xs font-sans text-xs font-600 text-fg-3">
            {notScoringNote}
          </p>
        ) : rank !== null && rank > 1 ? (
          <p className="mt-1 font-sans text-xs font-600 uppercase tracking-[1px] text-fg-3">
            {pointsBehind} pts behind leader
          </p>
        ) : null}
        {pointsDeducted > 0 && (
          <p className="mt-1 font-sans text-xs font-600 text-danger">
            −{pointsDeducted.toFixed(1)} pts deducted
          </p>
        )}
      </div>
    </section>
  );
}
