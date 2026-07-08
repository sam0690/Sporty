"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { usePublicMatches } from "@/hooks/matches/usePublicMatches";
import { ClockIcon } from "@/components/live/icons";
import { CompetitionPanel } from "./CompetitionPanel";
import { FeaturedMatch } from "./FeaturedMatch";
import { FixturesHero } from "./FixturesHero";
import { LiveTicker } from "./LiveTicker";
import { SportFilterChips } from "./SportFilterChips";
import { groupByCompetition, statusMeta } from "./matchFormat";

function SkeletonGrid() {
  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="skeleton h-56 rounded-[12px] border border-[rgba(255,255,255,0.06)]"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

export function PublicMatchesView() {
  const [sport, setSport] = useState<string>("all");
  const { data, isLoading, isError } = usePublicMatches({
    sport_name: sport === "all" ? undefined : sport,
    limit: 40,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
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
            <LiveTicker matches={liveMatches} />
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <SportFilterChips active={sport} onChange={setSport} />
        </div>

        {isLoading && (
          <>
            <div className="mt-8 h-40 rounded-[16px] border border-[rgba(255,255,255,0.06)] skeleton" />
            <SkeletonGrid />
          </>
        )}

        {!isLoading && isError && (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-[12px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.07)] px-4 py-8 text-center">
            <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#ff8a8a]">
              Couldn&apos;t load fixtures
            </p>
            <p className="text-sm text-[#c98686]">Please try again in a moment.</p>
          </div>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#0f0f14] p-14 text-center">
            <span className="grid size-11 place-items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[#555560]">
              <ClockIcon className="size-5" />
            </span>
            <p className="font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#9a9aa5]">
              No fixtures right now
            </p>
            <p className="mt-1 max-w-[32ch] text-sm text-[#555560]">
              Check back soon — fixtures appear here as they&apos;re scheduled.
            </p>
          </div>
        )}

        {!isLoading && !isError && groups.length > 0 && (
          <>
            {featured && (
              <div className="mt-8">
                <FeaturedMatch match={featured} />
              </div>
            )}

            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((g, i) => (
                <CompetitionPanel
                  key={`${g.competition}::${g.sport}`}
                  group={g}
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                />
              ))}
            </div>

            <div className="relative mt-10 flex flex-col items-center gap-3 overflow-hidden rounded-[16px] border border-[rgba(232,251,37,0.22)] bg-gradient-to-b from-[rgba(232,251,37,0.06)] to-transparent p-8 text-center sm:p-12">
              <div
                aria-hidden
                className="glow-orb left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 bg-[#e8fb25] opacity-[0.1]"
              />
              <p className="relative font-bebas text-3xl tracking-[2px] text-[#f0f0f0] sm:text-4xl">
                Turn these fixtures into points
              </p>
              <p className="relative max-w-md text-sm text-[#9a9aa5]">
                Build a fantasy squad, set your lineup, and score from every
                match — across football, basketball and cricket.
              </p>
              <Link
                href="/register"
                className="relative mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#e8fb25] px-6 py-3 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#0a0a0f] shadow-[0_10px_30px_-10px_rgba(232,251,37,0.5)] transition-transform hover:scale-[1.03] hover:bg-[#f0ff45] hover:no-underline"
              >
                Get Started Free →
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
