"use client";

type PublicLeague = {
  id: string;
  name: string;
  sport: "football" | "basketball" | "cricket" | "multisport";
  memberCount: number;
  requiresInviteCode: boolean;
  joinableNow?: boolean;
  joinMessage?: string;
  midseasonEntryWindowNumber?: number | null;
  inviteCode?: string;
};

type PublicLeaguesListProps = {
  leagues: PublicLeague[];
  onJoin: (league: PublicLeague) => Promise<void> | void;
};

const sportBadgeStyles: Record<PublicLeague["sport"], string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
  multisport: "⚽🏀🏏",
};

export function PublicLeaguesList({ leagues, onJoin }: PublicLeaguesListProps) {
  return (
    <section className="mx-auto max-w-2xl space-y-3">
      <h2 className="mb-4 text-md font-medium text-black">Public Leagues</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {leagues.map((league) => (
          <article
            key={league.id}
            className="rounded-md border border-accent/20 bg-white p-4 animate-[fade-soft_0.2s_ease]"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-black">{league.name}</h3>
              <span
                className="text-base"
                aria-label={league.sport}
                title={league.sport}
              >
                {sportBadgeStyles[league.sport]}
              </span>
            </div>
            <p className="mt-2 text-sm text-secondary">
              Members: {league.memberCount}
            </p>
            <p className="text-xs text-secondary">
              {league.requiresInviteCode
                ? "Requires invite code"
                : "Open for direct join"}
            </p>
            {league.joinMessage ? (
              <p className="mt-1 text-xs text-secondary">{league.joinMessage}</p>
            ) : null}
            {league.midseasonEntryWindowNumber ? (
              <p className="mt-1 text-xs text-amber-700">
                Scoring starts from transfer window{" "}
                {league.midseasonEntryWindowNumber}
              </p>
            ) : null}

            <button
              type="button"
              disabled={
                league.requiresInviteCode || league.joinableNow === false
              }
              onClick={() => onJoin(league)}
              className="mt-3 rounded-full border border-border bg-white px-4 py-1.5 text-sm font-medium text-black transition-colors hover:border-primary-500 disabled:cursor-not-allowed disabled:border-border disabled:bg-accent/20 disabled:text-secondary/60"
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
