"use client";

type TopPlayer = {
  name: string;
  points: number;
  league: string;
};

type PlayerHighlightsProps = {
  topPlayers: TopPlayer[];
};

export function PlayerHighlights({ topPlayers }: PlayerHighlightsProps) {
  return (
    <section className="rounded-[3px] border border-white/8 bg-surface-3 p-5 ">
      <h3 className="text-base text-fg-1">
        Player Highlights
      </h3>

      <div className="mt-4 space-y-3">
        {topPlayers.map((player) => (
          <article
            key={`${player.name}-${player.league}`}
            className="flex items-center justify-between gap-3 rounded-[3px] border border-white/8 bg-surface-3 p-3"
          >
            <div>
              <p className="text-sm text-fg-1">
                {player.name}
              </p>
              <p className="text-xs text-fg-3">{player.league}</p>
            </div>
            <span className="rounded-[3px] border border-white/8 bg-surface-3 px-3 py-1 text-xs text-fg-1">
              {player.points} pts
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { TopPlayer };
