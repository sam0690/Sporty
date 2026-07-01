"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { usePublicMatches } from "@/hooks/matches/usePublicMatches";
import { SPORT_GLYPHS, sportGlyph } from "@/components/landing/sport-icons";
import type { TMatch } from "@/types/match";

function kickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

type Group = { competition: string; sport: string; matches: TMatch[]; live: number };

function groupByCompetition(items: TMatch[]): Group[] {
  const map = new Map<string, Group>();
  for (const m of items) {
    const key = m.competition || m.sport || "Fixtures";
    if (!map.has(key)) {
      map.set(key, { competition: key, sport: m.sport, matches: [], live: 0 });
    }
    const g = map.get(key)!;
    g.matches.push(m);
    if ((m.status ?? "").toLowerCase() === "live") g.live += 1;
  }
  const liveRank = (m: TMatch) =>
    (m.status ?? "").toLowerCase() === "live" ? 0 : 1;
  return [...map.values()]
    .map((g) => ({
      ...g,
      matches: g.matches.sort(
        (a, b) =>
          liveRank(a) - liveRank(b) ||
          new Date(a.match_date).getTime() - new Date(b.match_date).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        (b.live > 0 ? 1 : 0) - (a.live > 0 ? 1 : 0) ||
        new Date(a.matches[0].match_date).getTime() -
          new Date(b.matches[0].match_date).getTime(),
    );
}

function TeamRow({ name, score }: { name: string; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="truncate font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
        {name}
      </span>
      {score != null && (
        <span className="shrink-0 font-bebas text-lg leading-none tracking-[1px] tabular-nums text-[#0B1220]">
          {score}
        </span>
      )}
    </div>
  );
}

function MatchRow({ match }: { match: TMatch }) {
  const status = (match.status ?? "").toLowerCase();
  const isLive = status === "live";
  const isFinished = status === "finished";
  const hasScore = match.home_score != null && match.away_score != null;

  return (
    <Link
      href={`/fixtures/${match.id}`}
      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[rgba(11,18,32,0.03)] hover:no-underline"
      style={isLive ? { borderLeft: "2px solid #DC2626" } : undefined}
    >
      <div className="w-14 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] text-[#DC2626]">
            <span className="size-1.5 rounded-full bg-[#DC2626] animate-live-pulse" />
            Live
          </span>
        ) : isFinished ? (
          <span className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#6B7280]">
            FT
          </span>
        ) : (
          <div className="leading-tight">
            <span className="block font-bebas text-base leading-none tracking-[1px] text-[#6B7280]">
              {kickoff(match.match_date)}
            </span>
            {!isToday(match.match_date) && (
              <span className="mt-0.5 block text-[9px] uppercase tracking-[1px] text-[#6B7280]">
                {shortDate(match.match_date)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <TeamRow name={match.home_team} score={hasScore ? match.home_score : null} />
        <TeamRow name={match.away_team} score={hasScore ? match.away_score : null} />
      </div>

      <span className="section-label shrink-0 text-[#6B7280] transition-colors group-hover:text-[#DC2626]">
        ›
      </span>
    </Link>
  );
}

function CompetitionPanel({ group }: { group: Group }) {
  const glyph = sportGlyph(group.sport);
  const Glyph = glyph.Icon;
  return (
    <section className="overflow-hidden rounded-[12px] border border-[rgba(11,18,32,0.08)] bg-gradient-to-b from-[#FFFFFF] to-[#FFFFFF]">
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(11,18,32,0.07)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-[6px]"
            style={{ color: glyph.color, background: `${glyph.color}1a` }}
          >
            <Glyph className="size-3.5" />
          </span>
          <span className="truncate font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#3A4256]">
            {group.competition}
          </span>
        </div>
        {group.live > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,59,92,0.3)] bg-[rgba(255,59,92,0.1)] px-2 py-0.5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#DC2626]">
            <span className="size-1.5 rounded-full bg-[#DC2626] animate-live-pulse" />
            {group.live} Live
          </span>
        )}
      </header>
      <div className="divide-y divide-[rgba(11,18,32,0.05)]">
        {group.matches.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </div>
    </section>
  );
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
          ? "inline-flex items-center gap-2 rounded-full bg-[#DC2626] px-3.5 py-1.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#F6F7F9]"
          : "inline-flex items-center gap-2 rounded-full border border-[rgba(11,18,32,0.12)] px-3.5 py-1.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280] transition-colors hover:border-[rgba(11,18,32,0.28)] hover:text-[#0B1220]"
      }
    >
      {children}
    </button>
  );
}

export function PublicMatchesView() {
  const [sport, setSport] = useState<string>("all");
  const { data, isLoading, isError } = usePublicMatches({
    sport_name: sport === "all" ? undefined : sport,
    limit: 40,
  });

  const groups = useMemo(
    () => groupByCompetition(data?.items ?? []),
    [data],
  );
  const totalLive = groups.reduce((n, g) => n + g.live, 0);

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 12% 0%, rgba(220,38,38,0.07), transparent 55%), radial-gradient(55% 50% at 90% 0%, rgba(0,212,255,0.06), transparent 55%)",
        }}
      />
      <main className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="border-b border-[rgba(11,18,32,0.08)] pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-label">Matchday</p>
              <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#0B1220] sm:text-6xl">
                Fixtures &amp; Results
              </h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Live scores, upcoming kickoffs and recent results — free to browse,
                no account needed.
              </p>
            </div>
            {totalLive > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,59,92,0.3)] bg-[rgba(255,59,92,0.1)] px-3 py-1.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#DC2626]">
                <span className="size-1.5 rounded-full bg-[#DC2626] animate-live-pulse" />
                {totalLive} playing now
              </span>
            )}
          </div>
        </header>

        {/* sport filter */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Chip active={sport === "all"} onClick={() => setSport("all")}>
            All Sports
          </Chip>
          {SPORT_GLYPHS.map(({ Icon, label, color }) => {
            const key = label.toLowerCase();
            return (
              <Chip
                key={key}
                active={sport === key}
                onClick={() => setSport(key)}
              >
                <span style={{ color: sport === key ? undefined : color }}>
                  <Icon className="size-4" />
                </span>
                {label}
              </Chip>
            );
          })}
        </div>

        {isLoading && (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-[12px] bg-[#FFFFFF]" />
            ))}
          </div>
        )}

        {isError && (
          <p className="mt-8 rounded-[10px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.07)] px-4 py-3 text-sm text-[#DC2626]">
            Couldn&apos;t load fixtures. Please try again.
          </p>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="mt-8 rounded-[12px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-12 text-center">
            <p className="font-barlow-condensed text-base font-bold uppercase tracking-[1px] text-[#6B7280]">
              No fixtures right now
            </p>
            <p className="mt-1 text-sm text-[#6B7280]">
              Check back soon — fixtures appear here as they&apos;re scheduled.
            </p>
          </div>
        )}

        {!isLoading && !isError && groups.length > 0 && (
          <>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <CompetitionPanel key={g.competition} group={g} />
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center gap-3 rounded-[14px] border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.05)] p-8 text-center">
              <p className="font-bebas text-3xl tracking-[2px] text-[#0B1220]">
                Turn these fixtures into points
              </p>
              <p className="max-w-md text-sm text-[#6B7280]">
                Build a fantasy squad, set your lineup, and score from every
                match — across football, basketball and cricket.
              </p>
              <Link
                href="/register"
                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#DC2626] px-6 py-3 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] shadow-[0_10px_30px_-10px_rgba(220,38,38,0.5)] transition-colors hover:bg-[#B91C1C] hover:no-underline"
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
