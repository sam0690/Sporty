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
      <article className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl animate-[fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">🏆</p>
        <p className="text-xs uppercase tracking-wider text-foreground/55">
          Top Scorer
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {topScorer.name} · {topScorer.points} pts
        </p>
        <p className="text-sm text-foreground/60">{topScorer.team}</p>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl animate-[fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">🔥</p>
        <p className="text-xs uppercase tracking-wider text-foreground/55">
          Highest Weekly Score
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {highestWeeklyScore.team} · {highestWeeklyScore.score}
        </p>
        <p className="text-sm text-foreground/60">
          Week {highestWeeklyScore.week}
        </p>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl animate-[fade-soft_0.2s_ease]">
        <p className="mb-2 text-xl">⚖️</p>
        <p className="text-xs uppercase tracking-wider text-foreground/55">
          Closest Match
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {closestMatch.matchup}
        </p>
        <p className="text-sm text-foreground/60">
          {closestMatch.difference} pts difference
        </p>
      </article>
    </section>
  );
}

export type { StatsHighlights };
