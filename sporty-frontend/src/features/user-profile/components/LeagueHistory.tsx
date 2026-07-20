"use client";

import {
  BasketballGlyph,
  BoltGlyph,
  CricketGlyph,
  FootballGlyph,
} from "@/components/landing/sport-icons";

type LeagueRow = {
  id: number;
  name: string;
  sport: "football" | "basketball" | "cricket" | "multisport";
  rank: number;
  points: number;
};

type LeagueHistoryProps = {
  leagues: LeagueRow[];
};

const SPORT_META: Record<
  LeagueRow["sport"],
  { Icon: typeof FootballGlyph; color: string; label: string }
> = {
  football: { Icon: FootballGlyph, color: "#00ff88", label: "Football" },
  basketball: { Icon: BasketballGlyph, color: "#ff6b35", label: "Basketball" },
  cricket: { Icon: CricketGlyph, color: "#00d4ff", label: "Cricket" },
  multisport: { Icon: BoltGlyph, color: "#e2c368", label: "Multi-Sport" },
};

export function LeagueHistory({ leagues }: LeagueHistoryProps) {
  return (
    <section className="overflow-hidden card-surface">
      <header className="border-b border-white/7 px-5 py-4">
        <p className="section-label">League History</p>
      </header>

      <div className="max-h-80 overflow-y-auto px-5">
        {leagues.length === 0 ? (
          <p className="py-5 text-sm text-fg-3">Not in any leagues yet.</p>
        ) : (
          <ul className="divide-y divide-white/6">
            {leagues.map((league) => {
              const meta = SPORT_META[league.sport];
              const Icon = meta.Icon;
              return (
                <li
                  key={league.id}
                  className="flex items-center justify-between gap-3 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3" style={{ color: meta.color }}>
                    <Icon className="size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                        {league.name}
                      </p>
                      <p className="mt-0.5 text-xs">{meta.label}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <div>
                      <p className="num font-display text-lg leading-none tracking-[-0.02em] text-fg-1">
                        {league.rank > 0 ? `#${league.rank}` : "—"}
                      </p>
                      <p className="section-label mt-1">Rank</p>
                    </div>
                    <div>
                      <p className="num font-display text-lg leading-none tracking-[-0.02em] text-accent">
                        {Math.round(league.points)}
                      </p>
                      <p className="section-label mt-1">Pts</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export type { LeagueRow };
