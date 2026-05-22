"use client";

type TeamHeaderProps = {
  totalPlayers: number;
};

export function TeamHeader({ totalPlayers }: TeamHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4 rounded-[2rem] border border-white/10 bg-surface/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[0.04em] text-foreground uppercase sm:text-4xl">
          My Team
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Your players across all leagues
        </p>
      </div>

      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold text-slate-200">
        {totalPlayers} players
      </span>
    </header>
  );
}
