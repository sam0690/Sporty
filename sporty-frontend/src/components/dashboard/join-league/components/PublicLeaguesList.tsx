"use client";

type PublicLeague = {
  id: number;
  name: string;
  sport: "football" | "basketball" | "cricket" | "multisport";
  memberCount: number;
  requiresInviteCode: boolean;
};

type PublicLeaguesListProps = {
  leagues: PublicLeague[];
  onJoin: (league: PublicLeague) => Promise<void> | void;
};

const sportBadgeStyles: Record<PublicLeague["sport"], string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
  multisport: "bg-gradient-to-r from-accent-football/15 via-accent-basketball/15 to-accent-cricket/15 text-primary-700",
};

export function PublicLeaguesList({ leagues, onJoin }: PublicLeaguesListProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">Browse Public Leagues</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {leagues.map((league) => (
          <article key={league.id} className="rounded-lg border border-border bg-surface-100 p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-text-primary">{league.name}</h3>
              <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${sportBadgeStyles[league.sport]}`}>
                {league.sport}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">Members: {league.memberCount}</p>
            <p className="text-xs text-text-secondary">
              {league.requiresInviteCode ? "Requires invite code" : "Open for direct join"}
            </p>

            <button
              type="button"
              disabled={league.requiresInviteCode}
              onClick={() => onJoin(league)}
              className="mt-3 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Join
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { PublicLeague };
