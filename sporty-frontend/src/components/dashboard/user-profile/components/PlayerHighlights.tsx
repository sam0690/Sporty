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
    <section className="rounded-lg border border-accent/20 bg-white p-5">
      <h3 className="text-base font-medium text-black">Player Highlights</h3>

      <div className="mt-4 space-y-3">
        {topPlayers.map((player) => (
          <article key={`${player.name}-${player.league}`} className="flex items-center justify-between gap-3 rounded-md border border-accent/20 p-3">
            <div>
              <p className="text-sm font-medium text-black">{player.name}</p>
              <p className="text-xs text-secondary">{player.league}</p>
            </div>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-black">
              {player.points} pts
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { TopPlayer };
