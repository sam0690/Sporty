"use client";

type StatsHighlights = {
  topScorer: { name: string; team: string; points: number };
  highestWeeklyScore: { team: string; score: number; week: number };
  closestMatch: { matchup: string; difference: number };
};

type StatsHighlightProps = StatsHighlights;

export function StatsHighlight({
  topScorer,
  highestWeeklyScore,
  closestMatch,
}: StatsHighlightProps) {
  return (
    <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <article className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4  animate-[fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">🏆</p>
        <p className="text-xs uppercase tracking-wider text-[#555560]">
          Top Scorer
        </p>
        <p className="mt-1 text-sm text-[#f0f0f0]">
          {topScorer.name} · {topScorer.points} pts
        </p>
        <p className="text-sm text-[#555560]">{topScorer.team}</p>
      </article>

      <article className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4  animate-[fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">🔥</p>
        <p className="text-xs uppercase tracking-wider text-[#555560]">
          Highest Weekly Score
        </p>
        <p className="mt-1 text-sm text-[#f0f0f0]">
          {highestWeeklyScore.team} · {highestWeeklyScore.score}
        </p>
        <p className="text-sm text-[#555560]">
          Week {highestWeeklyScore.week}
        </p>
      </article>

      <article className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4  animate-[fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">⚖️</p>
        <p className="text-xs uppercase tracking-wider text-[#555560]">
          Closest Match
        </p>
        <p className="mt-1 text-sm text-[#f0f0f0]">
          {closestMatch.matchup}
        </p>
        <p className="text-sm text-[#555560]">
          {closestMatch.difference} pts difference
        </p>
      </article>
    </section>
  );
}

export type { StatsHighlights };
