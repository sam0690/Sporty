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
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <h3 className="text-base font-medium text-foreground">
        Player Highlights
      </h3>

      <div className="mt-4 space-y-3">
        {topPlayers.map((player) => (
          <article
            key={`${player.name}-${player.league}`}
            className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {player.name}
              </p>
              <p className="text-xs text-foreground/55">{player.league}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground">
              {player.points} pts
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { TopPlayer };
