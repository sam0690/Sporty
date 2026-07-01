"use client";

import { Trophy, Flame, Scale } from "lucide-react";

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
      <article className="surface p-4">
        <Trophy className="mb-2 h-5 w-5 text-primary" strokeWidth={2} />
        <p className="micro-label">Top Scorer</p>
        <p className="mt-1 text-sm text-ink">
          {topScorer.name} · <span className="num">{topScorer.points}</span> pts
        </p>
        <p className="text-sm text-ink-muted">{topScorer.team}</p>
      </article>

      <article className="surface p-4">
        <Flame className="mb-2 h-5 w-5 text-primary" strokeWidth={2} />
        <p className="micro-label">Highest Weekly Score</p>
        <p className="mt-1 text-sm text-ink">
          {highestWeeklyScore.team} · <span className="num">{highestWeeklyScore.score}</span>
        </p>
        <p className="text-sm text-ink-muted">Week {highestWeeklyScore.week}</p>
      </article>

      <article className="surface p-4">
        <Scale className="mb-2 h-5 w-5 text-primary" strokeWidth={2} />
        <p className="micro-label">Closest Match</p>
        <p className="mt-1 text-sm text-ink">{closestMatch.matchup}</p>
        <p className="text-sm text-ink-muted">
          <span className="num">{closestMatch.difference}</span> pts difference
        </p>
      </article>
    </section>
  );
}

export type { StatsHighlights };
