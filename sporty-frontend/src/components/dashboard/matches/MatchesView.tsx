"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

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
          ? "rounded-full bg-[#DC2626] px-3.5 py-1.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#F6F7F9]"
          : "rounded-full border border-[rgba(11,18,32,0.12)] px-3.5 py-1.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280] transition-colors hover:border-[rgba(11,18,32,0.28)] hover:text-[#0B1220]"
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
      <header className="border-b border-[rgba(11,18,32,0.08)] pb-6">
        <p className="section-label">Matchday Centre</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#0B1220] sm:text-6xl">
          Matches
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Fixtures across every sport, day by day.
        </p>
      </header>

      {sports.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={sportFilter === "all"} onClick={() => setSportFilter("all")}>
            All Sports
          </Chip>
          {sports.map((sport) => {
            const SportIcon = sportConfig(sport).Icon;
            return (
              <Chip
                key={sport}
                active={sportFilter === sport}
                onClick={() => setSportFilter(sport)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <SportIcon className="h-3.5 w-3.5" />
                  {sportConfig(sport).label}
                </span>
              </Chip>
            );
          })}
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
                    ? "border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.1)]"
                    : "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] hover:border-[rgba(11,18,32,0.18)]"
                }`}
              >
                <span
                  className={`block font-barlow-condensed text-xs font-bold uppercase tracking-[1px] ${
                    active ? "text-[#DC2626]" : "text-[#0B1220]"
                  }`}
                >
                  {relativeDayLabel(day.date)}
                </span>
                <span className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280]">
                  {day.liveCount > 0 && (
                    <span className="size-1.5 rounded-full bg-[#DC2626] animate-live-pulse" />
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
            <div key={i} className="h-16 animate-pulse rounded-[3px] bg-[#F3F4F7]" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-[#DC2626]">
          Couldn&apos;t load matches. Please try again.
        </p>
      )}

      {!isLoading && !isError && days.length === 0 && (
        <div className="surface flex flex-col items-center p-10 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
            aria-hidden
          >
            <CalendarDays className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="mt-3 font-condensed text-base font-bold uppercase tracking-[0.04em] text-ink">
            No fixtures
          </p>
          <p className="mt-1 text-sm text-[#6B7280]">
            {items.length === 0
              ? "Fixtures appear here as soon as they're scheduled."
              : "No matches for this sport."}
          </p>
        </div>
      )}

      {activeDay && (
        <section className="space-y-3">
          <h2 className="font-barlow-condensed text-sm font-bold uppercase tracking-[2px] text-[#6B7280]">
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
