"use client";

type StatsHighlights = {
  topScorer: { name: string; team: string; points: number };
  highestWeeklyScore: { team: string; score: number; week: number };
  closestMatch: { matchup: string; difference: number };
};

type StatsHighlightProps = StatsHighlights;

export function StatsHighlight({ topScorer, highestWeeklyScore, closestMatch }: StatsHighlightProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <article className="rounded-lg bg-surface-100 p-4 shadow-card">
        <p className="text-sm text-text-secondary">🏆 Top Scorer</p>
        <p className="mt-1 font-semibold text-text-primary">{topScorer.name}</p>
        <p className="text-sm text-text-secondary">{topScorer.team}</p>
        <p className="mt-2 text-lg font-semibold text-primary-600">{topScorer.points} pts</p>
      </article>

      <article className="rounded-lg bg-surface-100 p-4 shadow-card">
        <p className="text-sm text-text-secondary">🔥 Highest Weekly Score</p>
        <p className="mt-1 font-semibold text-text-primary">{highestWeeklyScore.team}</p>
        <p className="text-sm text-text-secondary">Week {highestWeeklyScore.week}</p>
        <p className="mt-2 text-lg font-semibold text-primary-600">{highestWeeklyScore.score}</p>
      </article>

      <article className="rounded-lg bg-surface-100 p-4 shadow-card">
        <p className="text-sm text-text-secondary">⚖️ Closest Match</p>
        <p className="mt-1 font-semibold text-text-primary">{closestMatch.matchup}</p>
        <p className="mt-2 text-lg font-semibold text-primary-600">{closestMatch.difference} pts diff</p>
      </article>
    </section>
  );
}

export type { StatsHighlights };
