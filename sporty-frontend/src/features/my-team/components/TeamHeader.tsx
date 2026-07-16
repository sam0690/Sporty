"use client";

type TeamHeaderProps = {
  leagueName?: string;
  teamName?: string;
};

// Title block only — squad counts live in SquadStats below, not up here.
export function TeamHeader({ leagueName, teamName }: TeamHeaderProps) {
  return (
    <header className="border-b border-white/8 pb-6">
      <p className="section-label">{leagueName || "Your Squad"}</p>
      <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
        My Team
      </h1>
      <p className="mt-1 text-sm text-fg-3">
        {teamName
          ? `${teamName}`
          : leagueName
            ? "Your squad in this league"
            : "Select a league to view your team"}
      </p>
    </header>
  );
}
