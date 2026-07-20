"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  BasketballGlyph,
  BoltGlyph,
  CricketGlyph,
  FootballGlyph,
} from "@/components/landing/sport-icons";
import {
  COUNTDOWN_URGENT_MS,
  formatCountdown,
} from "@/features/dashboard/lib/countdown";

export type Sport = "football" | "basketball" | "cricket" | "multisport";

export type LeagueRowState = "action" | "live" | "settled";

export type LeagueRowItem = {
  id: string;
  name: string;
  sport: Sport;
  teamName: string;
  memberCount: number;
  rank: number;
  points: number;
  lineupDeadlineAt: string | null;
  hasLineup: boolean;
  live: boolean;
};

const SPORT_META: Record<
  Sport,
  { Icon: typeof FootballGlyph; color: string; label: string }
> = {
  football: { Icon: FootballGlyph, color: "#00ff88", label: "Football" },
  basketball: { Icon: BasketballGlyph, color: "#ff6b35", label: "Basketball" },
  cricket: { Icon: CricketGlyph, color: "#00d4ff", label: "Cricket" },
  multisport: { Icon: BoltGlyph, color: "#e2c368", label: "Multi-sport" },
};

export function LeagueRow({
  league,
  state,
  nowMs,
  animationDelay = 0,
}: {
  league: LeagueRowItem;
  state: LeagueRowState;
  nowMs: number;
  animationDelay?: number;
}) {
  const meta = SPORT_META[league.sport];
  const Icon = meta.Icon;

  const deadlineMs = league.lineupDeadlineAt
    ? new Date(league.lineupDeadlineAt).getTime()
    : null;
  const urgent =
    deadlineMs != null && deadlineMs - nowMs < COUNTDOWN_URGENT_MS;
  const countdown = deadlineMs ? formatCountdown(deadlineMs, nowMs) : "";

  return (
    <div
      className="group flex items-center gap-4 card-surface px-4 py-3.5 opacity-0 transition-colors duration-150 animate-fade-soft hover:border-white/16"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <Link
        href={`/leagues/${league.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-[3px]"
          style={{ background: `${meta.color}14`, color: meta.color }}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-sans text-sm font-700 uppercase tracking-[1px] text-fg-1">
            {league.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-fg-3">
            {league.teamName} · {league.memberCount}{" "}
            {league.memberCount === 1 ? "member" : "members"}
          </span>
        </span>

        <span className="hidden shrink-0 items-baseline gap-1.5 text-right sm:flex">
          <span className="num font-display text-lg leading-none tracking-[-0.02em] text-accent">
            {league.rank > 0 ? `#${league.rank}` : "—"}
          </span>
          <span className="num text-xs text-fg-3">
            {Math.round(league.points)} pts
          </span>
        </span>
      </Link>

      <span className="flex shrink-0 items-center gap-3">
        {state === "action" && deadlineMs != null && (
          <>
            <span
              className={`num hidden font-sans text-xs font-700 tabular-nums sm:inline ${
                urgent ? "text-danger" : "text-fg-2"
              }`}
            >
              locks {countdown}
            </span>
            <Link
              href={`/leagues/${league.id}/lineup`}
              className="rounded-[3px] bg-accent px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-surface-0 transition-colors hover:bg-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Set XI
            </Link>
          </>
        )}

        {state === "live" && (
          <span className="inline-flex items-center gap-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-danger">
            <span className="size-2 animate-live-pulse rounded-full bg-danger" />
            Live
          </span>
        )}

        {state === "settled" && (
          <ChevronRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-fg-1" />
        )}
      </span>
    </div>
  );
}
