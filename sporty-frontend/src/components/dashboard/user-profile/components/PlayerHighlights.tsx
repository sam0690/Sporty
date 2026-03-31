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
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <h3 className="text-base font-medium text-gray-900">Player Highlights</h3>

      <div className="mt-4 space-y-3">
        {topPlayers.map((player) => (
          <article key={`${player.name}-${player.league}`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{player.name}</p>
              <p className="text-xs text-gray-500">{player.league}</p>
            </div>
            <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
              {player.points} pts
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { TopPlayer };
