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
    <header className="flex items-end justify-between gap-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5  ">
      <div>
        <h1 className="font-bebas tracking-[3px] text-[#f0f0f0] sm:text-4xl">
          My Team
        </h1>
        <p className="mt-1 text-sm text-[#555560]">
          {leagueName
            ? `League: ${leagueName}`
            : "Select a league to view your team"}
          {teamName ? ` • Team: ${teamName}` : ""}
        </p>
      </div>

      <span className="inline-flex items-center rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 text-xs font-600 text-[#f0f0f0]">
        {totalPlayers} players
      </span>
    </header>
  );
}
