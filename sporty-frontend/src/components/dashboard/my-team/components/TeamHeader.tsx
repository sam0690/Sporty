"use client";

type TeamHeaderProps = {
  totalPlayers: number;
};

export function TeamHeader({ totalPlayers }: TeamHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">My Team</h1>
        <p className="mt-1 text-sm text-secondary">Your players across all leagues</p>
      </div>

      <span className="inline-flex items-center rounded-full border border-border bg-[#F4F4F9] px-3 py-1 text-xs font-medium text-secondary">
        {totalPlayers} players
      </span>
    </header>
  );
}
