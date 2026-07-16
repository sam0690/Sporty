"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { ClockIcon } from "@/components/live/icons";
import { useAuth } from "@/context/auth-context";
import type { TMatch } from "@/types/match";
import { CompetitionPanel, MatchRow } from "./CompetitionPanel";
import { FixturesToolbar } from "./FixturesToolbar";
import { shiftDateKey } from "./MatchDateStrip";
import { groupByCompetition, statusMeta } from "./matchFormat";

const BASE_PATH = "/fixtures";

function SkeletonList() {
  return (
    <div className="mt-6 space-y-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="skeleton h-36 rounded-[3px] border border-white/6"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

type MatchesBrowserProps = {
  items: TMatch[];
  isLoading: boolean;
  isError: boolean;
  /** Showing the previous day/sport's data while the next loads. */
  isSwitching: boolean;
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
  isSwitching,
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

  return (
    <main className="relative mx-auto max-w-3xl px-4 pb-10 sm:px-6">
      <FixturesToolbar
        date={date}
        onDateChange={onDateChange}
        sport={sport}
        onSportChange={onSportChange}
        totalLive={liveMatches.length}
      />

      {isLoading && <SkeletonList />}

      {!isLoading && isError && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-[3px] border border-danger/25 bg-danger/7 px-4 py-8 text-center">
          <p className="font-sans text-sm font-700 uppercase tracking-[1px] text-danger-soft">
            Couldn&apos;t load fixtures
          </p>
          <p className="text-sm text-danger-soft/80">Please try again in a moment.</p>
        </div>
      )}

      {!isLoading && !isError && groups.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 card-surface p-12 text-center">
          <span className="grid size-11 place-items-center rounded-[3px] border border-white/8 text-fg-3">
            <ClockIcon className="size-5" />
          </span>
          <p className="font-sans text-base font-700 uppercase tracking-[1px] text-fg-2">
            No fixtures on this date
          </p>
          <p className="max-w-[32ch] text-sm text-fg-3">
            Try a nearby day — matchdays cluster around weekends.
          </p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => onDateChange(shiftDateKey(date, -1))}
              className="inline-flex items-center gap-1 rounded-[3px] border border-white/12 px-3.5 py-2 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
            >
              <ChevronLeft className="size-3.5" /> Previous day
            </button>
            <button
              type="button"
              onClick={() => onDateChange(shiftDateKey(date, 1))}
              className="inline-flex items-center gap-1 rounded-[3px] border border-white/12 px-3.5 py-2 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
            >
              Next day <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {!isLoading && !isError && groups.length > 0 && (
        <div
          className={`transition-opacity duration-200 ${isSwitching ? "opacity-50" : ""}`}
          aria-busy={isSwitching}
        >
          {/* Live matches pinned above everything, across competitions. */}
          {liveMatches.length > 0 && (
            <section className="mt-6 overflow-hidden card-surface border-danger/20">
              <header className="flex items-center justify-between border-b border-white/7 px-4 py-3">
                <span className="live-badge">Live now</span>
                <span className="font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
                  {liveMatches.length}
                </span>
              </header>
              <div className="divide-y divide-white/5">
                {liveMatches.map((m) => (
                  <MatchRow key={m.id} match={m} basePath={BASE_PATH} showCompetition />
                ))}
              </div>
            </section>
          )}

          <div className="mt-6 space-y-4">
            {groups.map((g, i) => (
              <CompetitionPanel
                key={`${g.competition}::${g.sport}`}
                group={g}
                basePath={BASE_PATH}
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {!user && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[3px] border border-accent/22 bg-accent/4 p-8 text-center sm:p-12">
          <p className="font-display text-3xl tracking-[-0.02em] text-fg-1 sm:text-4xl">
            Turn these fixtures into points
          </p>
          <p className="max-w-md text-sm text-fg-2">
            Build a fantasy squad, set your lineup, and score from every match
            — across football, basketball and cricket.
          </p>
          <Link
            href="/register"
            className="mt-1 inline-flex items-center gap-1.5 rounded-[3px] bg-accent px-6 py-3 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright hover:no-underline"
          >
            Get Started Free <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </main>
  );
}
