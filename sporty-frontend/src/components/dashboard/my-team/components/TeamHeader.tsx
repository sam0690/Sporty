"use client";

type TeamHeaderProps = {
  totalPlayers: number;
  leagueName?: string;
  teamName?: string;
};

export function TeamHeader({
  totalPlayers,
  leagueName,
  teamName,
}: TeamHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[rgba(11,18,32,0.08)] pb-6">
      <div className="min-w-0">
        <p className="section-label">{leagueName || "Your Squad"}</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#0B1220] sm:text-6xl">
          My Team
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          {teamName
            ? `${teamName}`
            : leagueName
              ? "Your squad in this league"
              : "Select a league to view your team"}
        </p>
      </div>

      <div className="text-right">
        <p className="font-bebas text-4xl leading-none tracking-[2px] text-[#DC2626]">
          {totalPlayers}
        </p>
        <p className="section-label mt-1">Players</p>
      </div>
    </header>
  );
}
