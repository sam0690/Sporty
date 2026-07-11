"use client";

import { sportGlyph } from "@/components/landing/sport-icons";

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

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 6M17 19a5.5 5.5 0 0 0-2.5-4.6" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="10.5" width="14" height="9" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

function LeagueCard({
  league,
  onJoin,
}: {
  league: PublicLeague;
  onJoin: PublicLeaguesListProps["onJoin"];
}) {
  const glyph = sportGlyph(league.sport);
  const Glyph = glyph.Icon;
  const disabled = league.requiresInviteCode || league.joinableNow === false;

  return (
    <article
      className="animate-fade-soft group flex flex-col overflow-hidden card-surface p-5 transition-colors hover:border-white/18"
      style={{ borderLeft: `3px solid ${glyph.color}` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-[3px]"
          style={{
            color: glyph.color,
            background: `${glyph.color}1a`,
            border: `1px solid ${glyph.color}59`,
          }}
        >
          <Glyph className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[0.5px] text-fg-1">
            {league.name}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-2">
            <UsersIcon className="size-3.5 text-fg-3" />
            {league.memberCount}{" "}
            {league.memberCount === 1 ? "member" : "members"}
          </p>
        </div>
      </div>

      {/* status pill */}
      <div className="mt-4">
        {league.requiresInviteCode ? (
          <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-white/12 bg-white/4 px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
            <LockIcon className="size-3" />
            Invite only
          </span>
        ) : league.joinableNow === false ? (
          <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-warning/25 bg-warning/8 px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-warning">
            Closed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-success/28 bg-success/8 px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-success">
            <span className="size-1.5 rounded-full bg-success" />
            Open to join
          </span>
        )}
      </div>

      {league.joinMessage ? (
        <p className="mt-3 text-xs leading-5 text-fg-2">
          {league.joinMessage}
        </p>
      ) : null}
      {league.midseasonEntryWindowNumber ? (
        <p className="mt-2 text-xs text-warning">
          Scoring starts from transfer window{" "}
          {league.midseasonEntryWindowNumber}
        </p>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onJoin(league)}
        className="mt-4 inline-flex w-full items-center justify-center rounded-[3px] bg-accent px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:bg-white/6 disabled:text-fg-3"
      >
        {disabled ? "Unavailable" : "Join League"}
      </button>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="card-surface p-10 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full border border-white/8 bg-white/2 text-fg-3">
        <UsersIcon className="size-5" />
      </span>
      <p className="mt-3 font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-fg-2">
        No public leagues
      </p>
      <p className="mt-1 text-xs text-fg-3">
        Ask for an invite code above, or create your own league.
      </p>
    </div>
  );
}

export function PublicLeaguesList({ leagues, onJoin }: PublicLeaguesListProps) {
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h2 className="section-label">Public Leagues</h2>
      {leagues.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {leagues.map((league) => (
            <LeagueCard key={league.id} league={league} onJoin={onJoin} />
          ))}
        </div>
      )}
    </section>
  );
}

export type { PublicLeague };
