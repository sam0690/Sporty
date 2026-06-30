"use client";

import { useRouter } from "next/navigation";

import type { TMatch } from "@/types/match";

type SportConfig = {
  emoji: string;
  label: string;
  accent: string;
  badge: string;
};

const SPORT_CONFIG: Record<string, SportConfig> = {
  football: {
    emoji: "⚽",
    label: "Football",
    accent: "#4caf50",
    badge: "sport-badge-football",
  },
  basketball: {
    emoji: "🏀",
    label: "Basketball",
    accent: "#ff6b00",
    badge: "sport-badge-basketball",
  },
  cricket: {
    emoji: "🏏",
    label: "Cricket",
    accent: "#00d4ff",
    badge: "sport-badge-cricket",
  },
};

const FALLBACK_SPORT: SportConfig = {
  emoji: "🎯",
  label: "Match",
  accent: "#e8fb25",
  badge: "sport-badge-multisport",
};

export function sportConfig(sport: string): SportConfig {
  return SPORT_CONFIG[sport?.toLowerCase()] ?? FALLBACK_SPORT;
}

function formatKickoff(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { day: "TBD", time: "" };
  }
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  let day: string;
  if (sameDay(date, today)) {
    day = "Today";
  } else if (sameDay(date, tomorrow)) {
    day = "Tomorrow";
  } else {
    day = date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { day, time };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff3b5c]/15 px-2.5 py-1 text-[10px] font-700 uppercase tracking-[1.5px] text-[#ff3b5c]">
        <span className="size-1.5 rounded-full bg-[#ff3b5c] animate-live-pulse" />
        Live
      </span>
    );
  }
  if (status === "finished") {
    return (
      <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[10px] font-700 uppercase tracking-[1.5px] text-[#777783]">
        Full Time
      </span>
    );
  }
  return null;
}

export function MatchCard({
  match,
  animationDelay = 0,
}: {
  match: TMatch;
  animationDelay?: number;
}) {
  const router = useRouter();
  const status = (match.status ?? "").toLowerCase();
  const sport = sportConfig(match.sport);
  const hasScore = match.home_score !== null && match.away_score !== null;
  const isUpcoming = !hasScore && status !== "finished";
  const { day, time } = formatKickoff(match.match_date);

  const open = () => router.push(`/match/${match.id}`);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="group cursor-pointer overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] opacity-0 transition-colors duration-150 hover:border-[rgba(255,255,255,0.18)] animate-fade-soft"
      style={{
        animationDelay: `${animationDelay}ms`,
        borderLeft: `3px solid ${sport.accent}`,
      }}
    >
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] ${sport.badge}`}
          >
            <span aria-hidden>{sport.emoji}</span>
            {sport.label}
          </span>
          <StatusBadge status={status} />
        </div>

        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-right font-barlow-condensed text-base font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
            {match.home_team}
          </p>

          <div className="shrink-0 text-center">
            {hasScore ? (
              <span className="font-bebas text-3xl leading-none tracking-[2px] text-[#e8fb25]">
                {match.home_score}
                <span className="px-1 text-[#555560]">-</span>
                {match.away_score}
              </span>
            ) : (
              <span className="font-bebas text-xl leading-none tracking-[1px] text-[#777783]">
                {time || "VS"}
              </span>
            )}
          </div>

          <p className="min-w-0 flex-1 truncate text-left font-barlow-condensed text-base font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
            {match.away_team}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] pt-3 text-xs text-[#555560]">
          <span className="min-w-0 truncate">
            {match.competition}
            {isUpcoming && day ? ` · ${day}` : ""}
          </span>
          <span className="shrink-0 section-label text-[#555560] transition-colors group-hover:text-[#e8fb25]">
            View →
          </span>
        </div>
      </div>
    </article>
  );
}
