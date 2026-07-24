"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Radio, SlidersHorizontal } from "lucide-react";

import { CalendarPopover } from "@/components/matches-browser/CalendarPopover";
import { MatchDateStrip, shiftDateKey, toDateKey } from "@/components/matches-browser/MatchDateStrip";
import { SportFilterChips } from "@/components/matches-browser/SportFilterChips";
import { useFixtures } from "@/hooks/fixtures/useFixtures";
import { useFollowedLeagues } from "@/hooks/fixtures/useFollowedLeagues";
import { FixturesService } from "@/services/FixturesService";
import type { TFixture } from "@/types/fixture";
import { groupFixturesByCompetition, leaguesFromFixtures } from "./fixtureFormat";
import { FixtureGroup } from "./components/FixtureGroup";
import { LeagueList } from "./components/LeagueList";
import { LeagueSheet } from "./components/LeagueSheet";

function makeFilters(sport: string, date: string) {
  return { sport_name: sport === "all" ? undefined : sport, date };
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="skeleton h-32 rounded-[3px] border border-white/6"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

export function FixturesView() {
  const [sport, setSport] = useState("all");
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [activeComp, setActiveComp] = useState<string | null>(null);
  const [liveOnly, setLiveOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const { followed, isFollowed, toggle } = useFollowedLeagues();

  const filters = makeFilters(sport, date);
  const { data, isLoading, isError, isPlaceholderData } = useFixtures(filters);
  const items = useMemo<TFixture[]>(() => data?.items ?? [], [data]);

  // Prefetch adjacent days for instant date-strip taps.
  useEffect(() => {
    for (const delta of [-1, 1]) {
      const near = makeFilters(sport, shiftDateKey(date, delta));
      void queryClient.prefetchQuery({
        queryKey: ["fixtures", "list", JSON.stringify(near)],
        queryFn: () => FixturesService.getFixtures(near),
        staleTime: 30_000,
      });
    }
  }, [sport, date, queryClient]);

  const leagues = useMemo(() => leaguesFromFixtures(items, followed), [items, followed]);
  const totalLive = useMemo(
    () => items.filter((f) => (f.status ?? "").toLowerCase() === "live").length,
    [items],
  );

  const visible = useMemo(() => {
    let out = items;
    if (activeComp) out = out.filter((f) => f.competition === activeComp);
    if (liveOnly) out = out.filter((f) => (f.status ?? "").toLowerCase() === "live");
    return out;
  }, [items, activeComp, liveOnly]);

  const groups = useMemo(
    () => groupFixturesByCompetition(visible, followed),
    [visible, followed],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Toolbar */}
      <div className="sticky top-16 z-30 -mx-4 mb-5 border-b border-white/8 bg-surface-0/95 px-4 pb-3 pt-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl leading-none tracking-[-0.02em] text-fg-1">
              Fixtures
            </h1>
            {totalLive > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-danger/30 bg-danger/10 px-2 py-0.5 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-danger">
                <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
                {totalLive} Live
              </span>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <MatchDateStrip selectedDate={date} onDateChange={setDate} />
            <CalendarPopover selectedDate={date} onDateChange={setDate} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <SportFilterChips active={sport} onChange={(s) => { setSport(s); setActiveComp(null); }} />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setLiveOnly((v) => !v)}
              aria-pressed={liveOnly}
              className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] transition-colors ${
                liveOnly
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-white/12 text-fg-2 hover:border-white/28 hover:text-fg-1"
              }`}
            >
              <Radio className="size-3.5" />
              Live
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-white/12 px-2.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1 lg:hidden"
            >
              <SlidersHorizontal className="size-3.5" />
              Leagues
            </button>
          </div>
        </div>
      </div>

      {/* Rail + main */}
      <div className="grid gap-6 lg:grid-cols-[248px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-40 card-surface max-h-[calc(100vh-11rem)] overflow-y-auto p-2">
            <LeagueList
              entries={leagues}
              active={activeComp}
              onSelect={setActiveComp}
              onToggleFollow={toggle}
            />
          </div>
        </aside>

        <main className="min-w-0">
          {isLoading && !isPlaceholderData ? (
            <Skeleton />
          ) : isError ? (
            <div className="card-surface px-6 py-16 text-center">
              <p className="text-sm text-fg-2">Couldn&apos;t load fixtures. Try again shortly.</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="card-surface px-6 py-16 text-center">
              <p className="text-sm text-fg-1">
                {liveOnly
                  ? "No live matches right now."
                  : activeComp
                    ? `No ${activeComp} matches on this day.`
                    : "No matches on this day."}
              </p>
              <p className="mt-1.5 text-xs text-fg-3">
                Matchdays cluster around weekends — try a nearby day.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setDate(shiftDateKey(date, 1))}
                  className="rounded-[3px] border border-white/12 px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
                >
                  Next day
                </button>
                <button
                  type="button"
                  onClick={() => setDate(toDateKey(new Date()))}
                  className="rounded-[3px] border border-white/12 px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
                >
                  Today
                </button>
              </div>
            </div>
          ) : (
            <div className={`space-y-4 ${isPlaceholderData ? "opacity-60" : ""}`}>
              {groups.map((g, i) => (
                <FixtureGroup
                  key={g.competition}
                  group={g}
                  followed={isFollowed(g.competition)}
                  onToggleFollow={toggle}
                  style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <LeagueSheet
        opened={sheetOpen}
        onClose={() => setSheetOpen(false)}
        entries={leagues}
        active={activeComp}
        onSelect={setActiveComp}
        onToggleFollow={toggle}
      />
    </div>
  );
}
