import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { TeamBadge } from "@/components/matches-browser/TeamBadge";
import {
  isToday,
  kickoffTime,
  shortDate,
  statusMeta,
} from "@/components/matches-browser/matchFormat";
import { fixtureHref, type TFixture } from "@/types/fixture";
import { matchIdentities } from "@/lib/teamIdentity";

function TeamRow({
  name,
  logoUrl,
  score,
  color,
}: {
  name: string;
  logoUrl?: string | null;
  score: number | null;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge name={name} logoUrl={logoUrl} size="sm" color={color} />
      <span className="min-w-0 flex-1 truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
        {name}
      </span>
      {score != null && (
        <span className="shrink-0 font-display text-lg leading-none tracking-[-0.02em] tabular-nums text-fg-1">
          {score}
        </span>
      )}
    </div>
  );
}

export function FixtureRow({ fixture }: { fixture: TFixture }) {
  const { isLive, isFinished } = statusMeta(fixture.status);
  // Two badges stacked in one row, so clubs sharing a brand colour would be
  // indistinguishable without this.
  const identities = matchIdentities(fixture.home_team, fixture.away_team);
  const hasScore = fixture.home_score != null && fixture.away_score != null;

  return (
    <Link
      href={fixtureHref(fixture)}
      className={`group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/3 hover:no-underline ${
        isLive ? "bg-danger/4" : ""
      }`}
    >
      <div className="w-14 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 font-sans text-[10px] font-700 uppercase tracking-[1px] text-danger">
            <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
            Live
          </span>
        ) : isFinished ? (
          <span className="font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
            FT
          </span>
        ) : (
          <div className="leading-tight">
            <span className="block font-display text-base leading-none tracking-[-0.02em] text-fg-2">
              {kickoffTime(fixture.match_date)}
            </span>
            {!isToday(fixture.match_date) && (
              <span className="mt-0.5 block text-[9px] uppercase tracking-[1px] text-fg-3">
                {shortDate(fixture.match_date)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <TeamRow
          name={fixture.home_team}
          logoUrl={fixture.home_team_logo_url}
          score={hasScore ? fixture.home_score : null}
          color={identities.home.color}
        />
        <TeamRow
          name={fixture.away_team}
          logoUrl={fixture.away_team_logo_url}
          score={hasScore ? fixture.away_score : null}
          color={identities.away.color}
        />
      </div>

      {fixture.stage && fixture.stage !== "LEAGUE_STAGE" && fixture.stage !== "GROUP_STAGE" && (
        <span className="hidden shrink-0 text-right text-[9px] uppercase tracking-[1px] text-fg-3 sm:block">
          {fixture.stage.replace(/_/g, " ")}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-fg-3 transition-colors group-hover:text-accent" />
    </Link>
  );
}
