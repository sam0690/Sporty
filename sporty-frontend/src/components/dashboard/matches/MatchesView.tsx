"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useMatches } from "@/hooks/matches/useMatches";
import type { TMatch } from "@/types/match";

const sportEmoji: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

const statusStyle: Record<string, string> = {
  live: "bg-[#e8fb25] text-black",
  scheduled: "bg-[rgba(255,255,255,0.08)] text-[#c8c8d0]",
  finished: "bg-[rgba(255,255,255,0.04)] text-[#777783]",
};

function formatKickoff(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MatchRow({ match }: { match: TMatch }) {
  const router = useRouter();
  const status = (match.status ?? "").toLowerCase();
  const hasScore = match.home_score !== null && match.away_score !== null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/match/${match.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/match/${match.id}`);
        }
      }}
      className="flex cursor-pointer items-center gap-4 rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 transition-colors hover:border-[#e8fb25]/40"
    >
      <span className="text-xl" aria-hidden>
        {sportEmoji[match.sport] ?? "🎯"}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-600 text-[#f0f0f0]">
          <span className="truncate">{match.home_team}</span>
          <span className="text-[#555560]">vs</span>
          <span className="truncate">{match.away_team}</span>
        </div>
        <div className="mt-1 truncate text-xs text-[#555560]">
          {match.competition} · {formatKickoff(match.match_date)}
        </div>
      </div>

      {hasScore && (
        <div className="shrink-0 text-sm font-600 text-[#f0f0f0]">
          {match.home_score} – {match.away_score}
        </div>
      )}

      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-600 uppercase tracking-wider ${
          statusStyle[status] ?? statusStyle.scheduled
        }`}
      >
        {status || "scheduled"}
      </span>
    </article>
  );
}

const GROUPS: Array<{ key: string; title: string; statuses: string[] }> = [
  { key: "live", title: "Live", statuses: ["live"] },
  { key: "upcoming", title: "Upcoming", statuses: ["scheduled"] },
  {
    key: "finished",
    title: "Finished",
    statuses: ["finished", "postponed", "cancelled"],
  },
];

export function MatchesView() {
  const { data, isLoading, isError } = useMatches();

  const grouped = useMemo(() => {
    const items = data?.items ?? [];
    return GROUPS.map((group) => ({
      ...group,
      matches: items.filter((m) =>
        group.statuses.includes((m.status ?? "").toLowerCase()),
      ),
    })).filter((group) => group.matches.length > 0);
  }, [data]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-600 text-[#f0f0f0]">Matches</h1>
        <p className="mt-1 text-sm text-[#555560]">
          Fixtures from your leagues&apos; sports. Open one for live scores,
          predictions and player ratings.
        </p>
      </header>

      {isLoading && (
        <p className="text-sm text-[#555560]">Loading fixtures…</p>
      )}

      {isError && (
        <p className="text-sm text-red-500">
          Couldn&apos;t load matches. Please try again.
        </p>
      )}

      {!isLoading && !isError && grouped.length === 0 && (
        <div className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-8 text-center text-sm text-[#555560]">
          No matches yet. Fixtures appear here once they&apos;re scheduled for a
          sport in one of your leagues.
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.key} className="space-y-3">
          <h2 className="text-xs font-600 uppercase tracking-wider text-[#777783]">
            {group.title}
          </h2>
          <div className="space-y-2">
            {group.matches.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
