"use client";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import type { MatchPrediction } from "@/types/events";
import { ChartIcon } from "./icons";

type PredictionCardProps = {
  prediction: MatchPrediction | null;
};

/** Win-probability band rendered inside the hero card's footer slot, so the
 *  model's call is part of the scoreline — visible in every phase without
 *  scrolling. The parent provides the card chrome and padding. */
export function PredictionCard({ prediction }: PredictionCardProps) {
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  if (!prediction) {
    return null;
  }

  const home = homeTeam ?? "Home";
  const away = awayTeam ?? "Away";

  const segments = [
    {
      key: "home",
      label: home,
      color: teamIdentity(home).color,
      value: prediction.home_win_prob,
      align: "text-left",
    },
    {
      key: "draw",
      label: "Draw",
      color: "#71717d",
      value: prediction.draw_prob,
      align: "text-center",
    },
    {
      key: "away",
      label: away,
      color: teamIdentity(away).color,
      value: prediction.away_win_prob,
      align: "text-right",
    },
  ];

  const total =
    segments.reduce((sum, s) => sum + s.value, 0) || 1; // guard divide-by-zero
  const pct = (v: number) => Math.round((v / total) * 100);

  const favourite = segments.reduce((a, b) => (b.value > a.value ? b : a));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-[3px] border"
            style={{
              color: "#e2c368",
              background: "#e2c36814",
              borderColor: "#e2c36833",
            }}
          >
            <ChartIcon className="size-3.5" />
          </span>
          <span className="section-label">Win Probability</span>
        </div>
        <span className="min-w-0 truncate font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
          {favourite.label} favoured
        </span>
      </div>

      <div
        role="img"
        aria-label={segments
          .map((s) => `${s.label} ${pct(s.value)}%`)
          .join(", ")}
        className="mt-3.5 flex h-2.5 w-full overflow-hidden rounded-[3px] bg-white/5"
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className="h-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct(s.value)}%`, background: s.color }}
          />
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-3">
        {segments.map((s) => (
          <div key={s.key} className={`min-w-0 ${s.align}`}>
            <p className="truncate font-sans text-[11px] font-700 uppercase tracking-[1px] text-fg-3">
              <span
                className="mr-1.5 inline-block size-2 rounded-full align-middle"
                style={{ background: s.color }}
              />
              {s.label}
            </p>
            <p className="mt-1 font-display text-xl leading-none tracking-[-0.02em] tabular-nums text-fg-1">
              {pct(s.value)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
