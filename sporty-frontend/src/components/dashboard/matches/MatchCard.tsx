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
  football: { emoji: "⚽", label: "Football", accent: "#4caf50", badge: "sport-badge-football" },
  basketball: { emoji: "🏀", label: "Basketball", accent: "#ff6b00", badge: "sport-badge-basketball" },
  cricket: { emoji: "🏏", label: "Cricket", accent: "#00d4ff", badge: "sport-badge-cricket" },
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

function kickoffTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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
  const isLive = status === "live";
  const isFinished = status === "finished";

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
      style={{ animationDelay: `${animationDelay}ms`, borderLeft: `3px solid ${sport.accent}` }}
      className="group flex cursor-pointer items-center gap-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-4 py-3 transition-colors hover:border-[rgba(255,255,255,0.18)] animate-fade-soft"
    >
      {/* Time / status rail */}
      <div className="w-16 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex flex-col items-center gap-0.5">
            <span className="inline-flex items-center gap-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#ff3b30]">
              <span className="size-1.5 rounded-full bg-[#ff3b30] animate-live-pulse" />
              Live
            </span>
          </span>
        ) : isFinished ? (
          <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#777783]">
            FT
          </span>
        ) : (
          <span className="font-bebas text-lg leading-none tracking-[1px] text-[#9a9aa5]">
            {kickoffTime(match.match_date)}
          </span>
        )}
      </div>

      {/* Teams + scores */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
            {match.home_team}
          </span>
          {hasScore && (
            <span className="shrink-0 font-bebas text-lg leading-none tracking-[1px] text-[#e8fb25]">
              {match.home_score}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
            {match.away_team}
          </span>
          {hasScore && (
            <span className="shrink-0 font-bebas text-lg leading-none tracking-[1px] text-[#e8fb25]">
              {match.away_score}
            </span>
          )}
        </div>
      </div>

      {/* Sport + chevron */}
      <div className="flex shrink-0 items-center gap-3">
        <span aria-hidden style={{ color: sport.accent }} className="text-sm">
          {sport.emoji}
        </span>
        <span className="section-label text-[#555560] transition-colors group-hover:text-[#e8fb25]">
          ›
        </span>
      </div>
    </article>
  );
}
