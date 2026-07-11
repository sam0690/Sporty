"use client";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import type { MatchPrediction } from "@/types/events";
import { Panel } from "./Panel";
import { ChartIcon } from "./icons";

type PredictionCardProps = {
  prediction: MatchPrediction | null;
};

export function PredictionCard({ prediction }: PredictionCardProps) {
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  if (!prediction) {
    return null;
  }

  const homeColor = teamIdentity(homeTeam ?? "Home").color;
  const awayColor = teamIdentity(awayTeam ?? "Away").color;
  const drawColor = "#555560";

  const segments = [
    { key: "home", label: "Home", color: homeColor, value: prediction.home_win_prob },
    { key: "draw", label: "Draw", color: drawColor, value: prediction.draw_prob },
    { key: "away", label: "Away", color: awayColor, value: prediction.away_win_prob },
  ];

  const total =
    segments.reduce((sum, s) => sum + s.value, 0) || 1; // guard divide-by-zero
  const pct = (v: number) => Math.round((v / total) * 100);

  const favourite = segments.reduce((a, b) => (b.value > a.value ? b : a));

  return (
    <Panel
      title="Outcome Prediction"
      icon={<ChartIcon className="size-3.5" />}
      action={
        <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#555560]">
          {favourite.label} favoured
        </span>
      }
    >
      {/* Single stacked probability bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-[3px] bg-[rgba(255,255,255,0.05)]">
        {segments.map((s) => (
          <div
            key={s.key}
            className="h-full transition-[width] duration-700 ease-out"
            style={{
              width: `${pct(s.value)}%`,
              background: s.color,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {segments.map((s) => (
          <div key={s.key} className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: s.color }}
              />
              <span className="font-barlow-condensed text-[11px] font-700 uppercase tracking-[1px] text-[#9a9aa5]">
                {s.label}
              </span>
            </div>
            <p className="mt-1 font-bebas text-2xl leading-none tracking-[1px] text-[#f0f0f0]">
              {pct(s.value)}%
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-2.5 text-right text-[10px] uppercase tracking-wider text-[#555560]">
        Model {prediction.model_version}
      </div>
    </Panel>
  );
}
