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
}> = [
  { key: "home_win_prob", label: "Home" },
  { key: "draw_prob", label: "Draw" },
  { key: "away_win_prob", label: "Away" },
];

export function PredictionCard({ prediction }: PredictionCardProps) {
  if (!prediction) {
    return null;
  }

  return (
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="text-xs uppercase tracking-wider text-[#555560]">
        Outcome Prediction
      </div>
      <div className="mt-3 space-y-2">
        {BARS.map(({ key, label }) => {
          const probability = prediction[key];
          const percent = Math.round(probability * 100);
          return (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span className="w-12 text-[#555560]">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                <div
                  className="h-full rounded-full bg-[#e8fb25]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-10 text-right font-600 text-[#f0f0f0]">
                {percent}%
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-right text-[10px] uppercase tracking-wider text-[#555560]">
        {prediction.model_version}
      </div>
    </div>
  );
}
