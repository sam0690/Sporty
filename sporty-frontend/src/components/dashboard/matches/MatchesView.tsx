"use client";

import { useMemo, useState } from "react";

import { useMatches } from "@/hooks/matches/useMatches";
import type { TMatch } from "@/types/match";
import { MatchCard, sportConfig } from "./MatchCard";

function keyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function relativeDayLabel(date: Date): string {
  const diff = Math.round(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fullDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-[#e8fb25] px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#0a0a0f]"
          : "rounded-full border border-[rgba(255,255,255,0.12)] px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors hover:border-[rgba(255,255,255,0.28)] hover:text-[#f0f0f0]"
      }
    >
      {children}
    </button>
  );
}

export function MatchesView() {
  const { data, isLoading, isError } = useMatches();
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const m of items) if (m.sport) set.add(m.sport.toLowerCase());
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (m) =>
          sportFilter === "all" || (m.sport ?? "").toLowerCase() === sportFilter,
      ),
    [items, sportFilter],
  );

  // Group fixtures by calendar day, each sorted by kickoff time.
  const days = useMemo(() => {
    const map = new Map<string, { date: Date; matches: TMatch[] }>();
    for (const m of filtered) {
      const d = new Date(m.match_date);
      if (Number.isNaN(d.getTime())) continue;
      const key = keyOf(d);
      if (!map.has(key)) map.set(key, { date: startOfDay(d), matches: [] });
      map.get(key)!.matches.push(m);
    }
    return [...map.values()]
      .map((v) => ({
        key: keyOf(v.date),
        date: v.date,
        matches: v.matches.sort(
          (a, b) =>
            new Date(a.match_date).getTime() - new Date(b.match_date).getTime(),
        ),
        liveCount: v.matches.filter(
          (m) => (m.status ?? "").toLowerCase() === "live",
        ).length,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filtered]);

  // Default day: today if present, else nearest upcoming, else the latest.
  const defaultDayKey = useMemo(() => {
    if (!days.length) return null;
    const todayKey = keyOf(new Date());
    if (days.some((d) => d.key === todayKey)) return todayKey;
    const today = startOfDay(new Date()).getTime();
    const upcoming = days.find((d) => d.date.getTime() >= today);
    return (upcoming ?? days[days.length - 1]).key;
  }, [days]);

  const activeDayKey =
    selectedDayKey && days.some((d) => d.key === selectedDayKey)
      ? selectedDayKey
      : defaultDayKey;
  const activeDay = days.find((d) => d.key === activeDayKey) ?? null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="border-b border-[rgba(255,255,255,0.08)] pb-6">
        <p className="section-label">Matchday Centre</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-6xl">
          Matches
        </h1>
        <p className="mt-1 text-sm text-[#555560]">
          Fixtures across every sport, day by day.
        </p>
      </header>

      {sports.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={sportFilter === "all"} onClick={() => setSportFilter("all")}>
            All Sports
          </Chip>
          {sports.map((sport) => (
            <Chip
              key={sport}
              active={sportFilter === sport}
              onClick={() => setSportFilter(sport)}
            >
              {sportConfig(sport).emoji} {sportConfig(sport).label}
            </Chip>
          ))}
        </div>
      )}

      {/* Day selector strip */}
      {days.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((day) => {
            const active = day.key === activeDayKey;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDayKey(day.key)}
                className={`shrink-0 rounded-[3px] border px-3.5 py-2 text-center transition-colors ${
                  active
                    ? "border-[rgba(232,251,37,0.4)] bg-[rgba(232,251,37,0.1)]"
                    : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] hover:border-[rgba(255,255,255,0.18)]"
                }`}
              >
                <span
                  className={`block font-barlow-condensed text-xs font-700 uppercase tracking-[1px] ${
                    active ? "text-[#e8fb25]" : "text-[#f0f0f0]"
                  }`}
                >
                  {relativeDayLabel(day.date)}
                </span>
                <span className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-[#555560]">
                  {day.liveCount > 0 && (
                    <span className="size-1.5 rounded-full bg-[#ff3b30] animate-live-pulse" />
                  )}
                  {day.matches.length} {day.matches.length === 1 ? "match" : "matches"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[3px] bg-[#1d1d26]" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-[#ff8a8a]">
          Couldn&apos;t load matches. Please try again.
        </p>
      )}

      {!isLoading && !isError && days.length === 0 && (
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-10 text-center">
          <p className="text-3xl" aria-hidden>
            📅
          </p>
          <p className="mt-3 font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            No fixtures
          </p>
          <p className="mt-1 text-sm text-[#555560]">
            {items.length === 0
              ? "Fixtures appear here as soon as they're scheduled."
              : "No matches for this sport."}
          </p>
        </div>
      )}

      {activeDay && (
        <section className="space-y-3">
          <h2 className="font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-[#9a9aa5]">
            {fullDayLabel(activeDay.date)}
          </h2>
          <div className="space-y-2">
            {activeDay.matches.map((match, idx) => (
              <MatchCard key={match.id} match={match} animationDelay={idx * 30} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
