"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";

import { ClockIcon } from "@/components/live/icons";
import { useAuth } from "@/context/auth-context";
import type { TMatch } from "@/types/match";
import { CompetitionPanel } from "./CompetitionPanel";
import { FeaturedMatch } from "./FeaturedMatch";
import { FixturesHero } from "./FixturesHero";
import { LiveTicker } from "./LiveTicker";
import { MatchDateStrip } from "./MatchDateStrip";
import { SportFilterChips } from "./SportFilterChips";
import { groupByCompetition, statusMeta } from "./matchFormat";

function SkeletonGrid() {
  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="skeleton h-56 rounded-[3px] border border-white/6"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

const BASE_PATH = "/fixtures";

type MatchesBrowserProps = {
  items: TMatch[];
  isLoading: boolean;
  isError: boolean;
  sport: string;
  onSportChange: (sport: string) => void;
  /** YYYY-MM-DD, drives the date strip. */
  date: string;
  onDateChange: (date: string) => void;
};

export function MatchesBrowser({
  items,
  isLoading,
  isError,
  sport,
  onSportChange,
  date,
  onDateChange,
}: MatchesBrowserProps) {
  // Signed-in managers don't need the "create an account" pitch.
  const { user } = useAuth();

  const liveMatches = useMemo(
    () => items.filter((m) => statusMeta(m.status).isLive),
    [items],
  );
  const groups = useMemo(() => groupByCompetition(items), [items]);
  const totalLive = liveMatches.length;
  const featured = liveMatches[0] ?? items[0] ?? null;

  return (
    <div className="relative overflow-hidden">
      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <FixturesHero
          totalFixtures={items.length}
          totalLive={totalLive}
          totalCompetitions={groups.length}
        />

        {liveMatches.length > 1 && (
          <div className="mt-5">
            <LiveTicker matches={liveMatches} basePath={BASE_PATH} />
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <SportFilterChips active={sport} onChange={onSportChange} />
          <MatchDateStrip selectedDate={date} onDateChange={onDateChange} />
        </div>

        {isLoading && (
          <>
            <div className="mt-8 h-40 rounded-[3px] border border-white/6 skeleton" />
            <SkeletonGrid />
          </>
        )}

        {!isLoading && isError && (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-[3px] border border-danger/25 bg-danger/7 px-4 py-8 text-center">
            <p className="font-sans text-sm font-700 uppercase tracking-[1px] text-danger-soft">
              Couldn&apos;t load fixtures
            </p>
            <p className="text-sm text-danger-soft/80">Please try again in a moment.</p>
          </div>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-3 card-surface p-14 text-center">
            <span className="grid size-11 place-items-center rounded-[3px] border border-white/8 text-fg-3">
              <ClockIcon className="size-5" />
            </span>
            <p className="font-sans text-base font-700 uppercase tracking-[1px] text-fg-2">
              No fixtures right now
            </p>
            <p className="mt-1 max-w-[32ch] text-sm text-fg-3">
              Check back soon — fixtures appear here as they&apos;re scheduled.
            </p>
          </div>
        )}

        {!isLoading && !isError && groups.length > 0 && (
          <>
            {featured && (
              <div className="mt-8">
                <FeaturedMatch match={featured} basePath={BASE_PATH} />
              </div>
            )}

            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((g, i) => (
                <CompetitionPanel
                  key={`${g.competition}::${g.sport}`}
                  group={g}
                  basePath={BASE_PATH}
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                />
              ))}
            </div>

            {!user && (
              <div className="mt-10 flex flex-col items-center gap-3 rounded-[3px] border border-accent/22 bg-accent/4 p-8 text-center sm:p-12">
                <p className="font-display text-3xl tracking-[-0.02em] text-fg-1 sm:text-4xl">
                  Turn these fixtures into points
                </p>
                <p className="max-w-md text-sm text-fg-2">
                  Build a fantasy squad, set your lineup, and score from every
                  match — across football, basketball and cricket.
                </p>
                <Link
                  href="/register"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-[3px] bg-accent px-6 py-3 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright hover:no-underline"
                >
                  Get Started Free <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
