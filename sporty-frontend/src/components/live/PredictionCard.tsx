"use client";

import type { MatchPrediction } from "@/types/events";

type PredictionCardProps = {
  prediction: MatchPrediction | null;
};

const BARS: Array<{
  key: keyof Pick<
    MatchPrediction,
    "home_win_prob" | "draw_prob" | "away_win_prob"
  >;
  label: string;
  color: string;
}> = [
  { key: "home_win_prob", label: "Home", color: "var(--football)" },
  { key: "draw_prob", label: "Draw", color: "var(--muted-foreground)" },
  { key: "away_win_prob", label: "Away", color: "var(--basketball)" },
];

export function PredictionCard({ prediction }: PredictionCardProps) {
  if (!prediction) {
    return null;
  }

  return (
    <section className="glass rounded-xl p-5">
      <span className="section-label">Outcome Prediction</span>

      <div className="mt-4 space-y-3">
        {BARS.map(({ key, label, color }) => {
          const percent = Math.round(prediction[key] * 100);
          return (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span className="w-12 font-600 text-muted-foreground">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${percent}%`, background: color }}
                />
              </div>
              <span className="w-10 text-right font-700 tabular-nums text-foreground">
                {percent}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
        {prediction.model_version}
      </div>
    </section>
  );
}
