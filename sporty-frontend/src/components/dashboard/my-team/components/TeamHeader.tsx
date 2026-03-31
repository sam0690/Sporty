"use client";

type TeamHeaderProps = {
  totalPlayers: number;
};

export function TeamHeader({ totalPlayers }: TeamHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-light tracking-tight text-gray-900">My Team</h1>
        <p className="mt-1 text-sm text-gray-500">Your players across all leagues</p>
      </div>

      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
        {totalPlayers} players
      </span>
    </header>
  );
}
