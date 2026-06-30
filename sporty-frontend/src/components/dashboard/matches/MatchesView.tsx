"use client";

import { useMemo, useState } from "react";

import { useMatches } from "@/hooks/matches/useMatches";
import type { TMatch } from "@/types/match";
import { MatchCard, sportConfig } from "./MatchCard";

type StatusKey = "all" | "live" | "upcoming" | "finished";

const STATUS_FILTERS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

const GROUPS: Array<{ key: Exclude<StatusKey, "all">; title: string; statuses: string[] }> = [
  { key: "live", title: "Live Now", statuses: ["live"] },
  { key: "upcoming", title: "Upcoming", statuses: ["scheduled"] },
  {
    key: "finished",
    title: "Results",
    statuses: ["finished", "postponed", "cancelled"],
  },
];

function statusBucket(status: string): Exclude<StatusKey, "all"> | null {
  const s = (status ?? "").toLowerCase();
  for (const group of GROUPS) {
    if (group.statuses.includes(s)) {
      return group.key;
    }
  }
  return null;
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

function StatBox({
  value,
  label,
  accent,
  pulse,
}: {
  value: number;
  label: string;
  accent: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex-1 px-5 py-4 text-center">
      <div className="flex items-center justify-center gap-2">
        {pulse && value > 0 && (
          <span className="size-2 rounded-full bg-[#ff3b5c] animate-live-pulse" />
        )}
        <p
          className="font-bebas text-3xl leading-none tracking-[2px]"
          style={{ color: accent }}
        >
          {value}
        </p>
      </div>
      <p className="section-label mt-1.5">{label}</p>
    </div>
  );
}

export function MatchesView() {
  const { data, isLoading, isError } = useMatches();
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");

  const items = useMemo(() => data?.items ?? [], [data]);

  const counts = useMemo(() => {
    let live = 0;
    let upcoming = 0;
    let finished = 0;
    for (const m of items) {
      const bucket = statusBucket(m.status);
      if (bucket === "live") live += 1;
      else if (bucket === "upcoming") upcoming += 1;
      else if (bucket === "finished") finished += 1;
    }
    return { live, upcoming, finished };
  }, [items]);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const m of items) {
      if (m.sport) set.add(m.sport.toLowerCase());
    }
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((m) => {
      const sportOk =
        sportFilter === "all" || (m.sport ?? "").toLowerCase() === sportFilter;
      const statusOk =
        statusFilter === "all" || statusBucket(m.status) === statusFilter;
      return sportOk && statusOk;
    });
  }, [items, sportFilter, statusFilter]);

  const grouped = useMemo(() => {
    return GROUPS.map((group) => ({
      ...group,
      matches: filtered
        .filter((m) => statusBucket(m.status) === group.key)
        .sort(
          (a: TMatch, b: TMatch) =>
            new Date(a.match_date).getTime() - new Date(b.match_date).getTime(),
        ),
    })).filter((group) => group.matches.length > 0);
  }, [filtered]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="border-b border-[rgba(255,255,255,0.08)] pb-6">
        <p className="section-label">Matchday Centre</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-6xl">
          Matches
        </h1>
        <p className="mt-1 text-sm text-[#555560]">
          Fixtures from your leagues&apos; sports. Open one for live scores,
          predictions and player ratings.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-0 divide-x divide-[rgba(255,255,255,0.08)] rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
        <StatBox value={counts.live} label="Live" accent="#ff3b5c" pulse />
        <StatBox value={counts.upcoming} label="Upcoming" accent="#e8fb25" />
        <StatBox value={counts.finished} label="Played" accent="#777783" />
      </section>

      {sports.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              active={sportFilter === "all"}
              onClick={() => setSportFilter("all")}
            >
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
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map(({ key, label }) => (
              <Chip
                key={key}
                active={statusFilter === key}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-[#555560]">Loading fixtures…</p>
      )}

      {isError && (
        <p className="text-sm text-[#ff3b5c]">
          Couldn&apos;t load matches. Please try again.
        </p>
      )}

      {!isLoading && !isError && grouped.length === 0 && (
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-10 text-center">
          <p className="text-3xl" aria-hidden>
            📅
          </p>
          <p className="mt-3 font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            No matches here
          </p>
          <p className="mt-1 text-sm text-[#555560]">
            {items.length === 0
              ? "Fixtures appear once they're scheduled for a sport in one of your leagues."
              : "Try a different sport or status filter."}
          </p>
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="flex items-center gap-2">
            {group.key === "live" && (
              <span className="size-2 rounded-full bg-[#ff3b5c] animate-live-pulse" />
            )}
            <h2 className="font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-[#9a9aa5]">
              {group.title}
            </h2>
            <span className="text-xs font-600 text-[#555560]">
              {group.matches.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.matches.map((match, idx) => (
              <MatchCard
                key={match.id}
                match={match}
                animationDelay={idx * 40}
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
