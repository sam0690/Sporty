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
  { key: "home_win_prob", label: "Home", color: "#e8fb25" },
  { key: "draw_prob", label: "Draw", color: "#555560" },
  { key: "away_win_prob", label: "Away", color: "#777783" },
];

export function PredictionCard({ prediction }: PredictionCardProps) {
  if (!prediction) {
    return null;
  }

  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <span className="section-label">Outcome Prediction</span>

      <div className="mt-4 space-y-3">
        {BARS.map(({ key, label, color }) => {
          const percent = Math.round(prediction[key] * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-12 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#9a9aa5]">
                {label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${percent}%`, background: color }}
                />
              </div>
              <span className="w-10 text-right font-bebas text-base leading-none tracking-[1px] text-[#f0f0f0]">
                {percent}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-right text-[10px] uppercase tracking-wider text-[#555560]">
        {prediction.model_version}
      </div>
    </section>
  );
}
