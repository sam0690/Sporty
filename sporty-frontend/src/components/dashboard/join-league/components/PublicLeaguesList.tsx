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
      className="animate-fade-soft group flex flex-col overflow-hidden rounded-[12px] border border-[rgba(11,18,32,0.08)] bg-gradient-to-b from-[#FFFFFF] to-[#FFFFFF] p-5 transition-colors hover:border-[rgba(11,18,32,0.18)]"
      style={{ borderLeft: `3px solid ${glyph.color}` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-[9px]"
          style={{
            color: glyph.color,
            background: `linear-gradient(160deg, ${glyph.color}2e, ${glyph.color}0d)`,
            border: `1px solid ${glyph.color}59`,
          }}
        >
          <Glyph className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-barlow-condensed text-base font-bold uppercase tracking-[0.5px] text-[#0B1220]">
            {league.name}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6B7280]">
            <UsersIcon className="size-3.5 text-[#6B7280]" />
            {league.memberCount}{" "}
            {league.memberCount === 1 ? "member" : "members"}
          </p>
        </div>
      </div>

      {/* status pill */}
      <div className="mt-4">
        {league.requiresInviteCode ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(11,18,32,0.12)] bg-[rgba(11,18,32,0.04)] px-2.5 py-1 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#6B7280]">
            <LockIcon className="size-3" />
            Invite only
          </span>
        ) : league.joinableNow === false ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,216,107,0.25)] bg-[rgba(255,216,107,0.08)] px-2.5 py-1 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#CA8A04]">
            Closed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,255,136,0.28)] bg-[rgba(0,255,136,0.08)] px-2.5 py-1 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#16A34A]">
            <span className="size-1.5 rounded-full bg-[#16A34A]" />
            Open to join
          </span>
        )}
      </div>

      {league.joinMessage ? (
        <p className="mt-3 text-xs leading-5 text-[#6B7280]">
          {league.joinMessage}
        </p>
      ) : null}
      {league.midseasonEntryWindowNumber ? (
        <p className="mt-2 text-xs text-[#CA8A04]">
          Scoring starts from transfer window{" "}
          {league.midseasonEntryWindowNumber}
        </p>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onJoin(league)}
        className="mt-4 inline-flex w-full items-center justify-center rounded-[9px] bg-[#DC2626] px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:bg-[rgba(11,18,32,0.06)] disabled:text-[#6B7280]"
      >
        {disabled ? "Unavailable" : "Join League"}
      </button>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[12px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-10 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full border border-[rgba(11,18,32,0.08)] bg-[rgba(11,18,32,0.02)] text-[#6B7280]">
        <UsersIcon className="size-5" />
      </span>
      <p className="mt-3 font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#6B7280]">
        No public leagues
      </p>
      <p className="mt-1 text-xs text-[#6B7280]">
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
