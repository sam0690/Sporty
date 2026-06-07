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
      <h2 className="mb-4 text-md text-[#f0f0f0]">
        Public Leagues
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {leagues.map((league) => (
          <article
            key={league.id}
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4   animate-[fade-soft_0.2s_ease]"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-[#f0f0f0]">{league.name}</h3>
              <span
                className="text-base"
                aria-label={league.sport}
                title={league.sport}
              >
                {sportBadgeStyles[league.sport]}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#555560]">
              Members: {league.memberCount}
            </p>
            <p className="text-xs text-[#555560]">
              {league.requiresInviteCode
                ? "Requires invite code"
                : "Open for direct join"}
            </p>
            {league.joinMessage ? (
              <p className="mt-1 text-xs text-[#555560]">
                {league.joinMessage}
              </p>
            ) : null}
            {league.midseasonEntryWindowNumber ? (
              <p className="mt-1 text-xs text-amber-300">
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
              className="mt-3 rounded-[3px] border border-border bg-white px-4 py-1.5 text-sm text-black transition-colors hover:border-primary-500 disabled:cursor-not-allowed disabled:border-border disabled:bg-accent/20 disabled:text-secondary/60"
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
