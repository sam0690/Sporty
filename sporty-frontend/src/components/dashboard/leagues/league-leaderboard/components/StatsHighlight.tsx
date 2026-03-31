"use client";

type StatsHighlights = {
  topScorer: { name: string; team: string; points: number };
  highestWeeklyScore: { team: string; score: number; week: number };
  closestMatch: { matchup: string; difference: number };
};

type StatsHighlightProps = StatsHighlights;

export function StatsHighlight({ topScorer, highestWeeklyScore, closestMatch }: StatsHighlightProps) {
  return (
    <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <article className="rounded-2xl border border-gray-100 bg-white p-4 [animation:fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">🏆</p>
        <p className="text-xs uppercase tracking-wider text-gray-500">Top Scorer</p>
        <p className="mt-1 text-sm font-medium text-gray-900">{topScorer.name} · {topScorer.points} pts</p>
        <p className="text-sm text-gray-600">{topScorer.team}</p>
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-4 [animation:fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">🔥</p>
        <p className="text-xs uppercase tracking-wider text-gray-500">Highest Weekly Score</p>
        <p className="mt-1 text-sm font-medium text-gray-900">{highestWeeklyScore.team} · {highestWeeklyScore.score}</p>
        <p className="text-sm text-gray-600">Week {highestWeeklyScore.week}</p>
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-4 [animation:fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">⚖️</p>
        <p className="text-xs uppercase tracking-wider text-gray-500">Closest Match</p>
        <p className="mt-1 text-sm font-medium text-gray-900">{closestMatch.matchup}</p>
        <p className="text-sm text-gray-600">{closestMatch.difference} pts difference</p>
      </article>
    </section>
  );
}

export type { StatsHighlights };
