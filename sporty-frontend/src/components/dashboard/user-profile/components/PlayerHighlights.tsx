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
    <section className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-5 ">
      <h3 className="text-base text-[#0B1220]">
        Player Highlights
      </h3>

      <div className="mt-4 space-y-3">
        {topPlayers.map((player) => (
          <article
            key={`${player.name}-${player.league}`}
            className="flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-3"
          >
            <div>
              <p className="text-sm text-[#0B1220]">
                {player.name}
              </p>
              <p className="text-xs text-[#6B7280]">{player.league}</p>
            </div>
            <span className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-3 py-1 text-xs text-[#0B1220]">
              {player.points} pts
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { TopPlayer };
