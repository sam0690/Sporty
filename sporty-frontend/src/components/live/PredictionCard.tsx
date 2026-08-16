"use client";

import { useMatchStore } from "@/store/matchStore";
import { matchIdentities } from "@/lib/teamIdentity";
import type { MatchPrediction } from "@/types/events";

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

  // Both sides of one fixture — never the same colour, even when the two
  // clubs share a brand colour.
  const identities = matchIdentities(home, away);

  const segments = [
    {
      key: "home",
      label: home,
      color: identities.home.color,
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
      color: identities.away.color,
      value: prediction.away_win_prob,
      align: "text-right",
    },
  ];

  const total =
    segments.reduce((sum, s) => sum + s.value, 0) || 1; // guard divide-by-zero
  const pct = (v: number) => Math.round((v / total) * 100);

  const favourite = segments.reduce((a, b) => (b.value > a.value ? b : a));

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="section-label">Win Probability</span>
        <span className="min-w-0 truncate font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
          {favourite.label} favoured
        </span>
      </div>

      <div
        role="img"
        aria-label={segments
          .map((s) => `${s.label} ${pct(s.value)}%`)
          .join(", ")}
        className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-white/6"
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `${pct(s.value)}%`, background: s.color }}
          />
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3">
        {segments.map((s) => (
          <div key={s.key} className={`min-w-0 ${s.align}`}>
            <p className="truncate font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
              <span
                className="mr-1 inline-block size-1.5 rounded-full align-middle"
                style={{ background: s.color }}
              />
              {s.label}
            </p>
            <p className="mt-0.5 font-display text-base leading-none tracking-[-0.02em] tabular-nums text-fg-1">
              {pct(s.value)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
