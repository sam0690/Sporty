"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { useRelativeTime } from "@/hooks/general/useRelativeTime";
import { COUNTDOWN_URGENT_MS, formatCountdown } from "../lib/countdown";
import type { OverviewStat } from "../types";

type TopbarProps = {
  userName: string;
  userId: string;
  avatar?: string;
  leagues: Array<{ id: string; name: string }>;
  selectedLeagueId: string | null;
  onLeagueChange: (leagueId: string) => void;
  stats: OverviewStat[];
  pointsDeducted?: number;
  statsLoading?: boolean;
  /** Previous league's numbers shown dimmed while the next league loads. */
  isSwitching?: boolean;
  /** Deadline spine. */
  lineupDeadlineAt: string | null;
  lineupLocked: boolean;
  hasLineup: boolean;
};

function StatCell({
  value,
  label,
  loading,
  accent = false,
}: {
  value: string;
  label: string;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      {loading ? (
        <div className="skeleton h-8 w-16 rounded-[3px]" />
      ) : (
        <p
          className={`num font-display text-3xl leading-none tracking-[-0.02em] ${
            accent ? "text-accent" : "text-fg-1"
          }`}
        >
          {value}
        </p>
      )}
      <p className="mt-2 text-xs text-fg-3">{label}</p>
    </div>
  );
}

export function Topbar({
  userName,
  userId,
  avatar,
  leagues,
  selectedLeagueId,
  onLeagueChange,
  stats,
  pointsDeducted = 0,
  statsLoading = false,
  isSwitching = false,
  lineupDeadlineAt,
  lineupLocked,
  hasLineup,
}: TopbarProps) {
  const router = useRouter();
  const nowMs = useRelativeTime({ refreshIntervalMs: 30_000 });
  const initial = userName.slice(0, 1).toUpperCase();

  const totalPoints = stats.find((s) => s.label === "Total Points");
  const rank = stats.find((s) => s.label === "Rank");
  const budget = stats.find((s) => s.label === "Budget");
  const gwPoints = stats.find((s) => s.label === "Gameweek Points");

  const deadlineMs = lineupDeadlineAt
    ? new Date(lineupDeadlineAt).getTime()
    : null;
  const countdown = deadlineMs ? formatCountdown(deadlineMs, nowMs) : "";
  const isPast = deadlineMs != null && deadlineMs <= nowMs;
  const locked = lineupLocked || isPast;
  const urgent =
    !locked && deadlineMs != null && deadlineMs - nowMs < COUNTDOWN_URGENT_MS;

  const lineupHref = selectedLeagueId
    ? `/leagues/${selectedLeagueId}/lineup`
    : null;

  return (
    <header className="mb-6 overflow-hidden card-surface px-5 py-5 sm:px-8 sm:py-7">
      {/* Band 1 — deadline spine: who you are + what to do next */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
        <div className="min-w-0">
          <p className="text-sm text-fg-3">Welcome back</p>
          <h1 className="mt-1 truncate font-display text-3xl leading-none tracking-[-0.02em] text-fg-1 sm:text-4xl">
            {userName}
          </h1>

          {leagues.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <select
                value={selectedLeagueId ?? ""}
                onChange={(event) => onLeagueChange(event.target.value)}
                className="max-w-[14rem] truncate rounded-[3px] border border-white/10 bg-transparent px-3 py-1.5 font-sans text-sm font-600 text-fg-1 transition-colors focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                aria-label="Choose active league"
              >
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
              {selectedLeagueId && (
                <Link
                  href={`/leagues/${selectedLeagueId}`}
                  className="group flex items-center gap-1 rounded-[3px] px-2 py-1.5 text-sm font-600 text-fg-3 transition-colors hover:text-accent"
                >
                  Open field
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex items-start gap-4">
          {selectedLeagueId && deadlineMs != null && (
            <div className="text-right">
              <p className="text-xs text-fg-3">
                {locked ? "Gameweek in progress" : "Lineup locks in"}
              </p>
              {locked ? (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-[3px] border border-white/10 px-2.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2">
                  <Lock className="size-3.5" />
                  Locked
                </span>
              ) : (
                <p
                  className={`num mt-1 font-display text-2xl leading-none tracking-[-0.02em] tabular-nums ${
                    urgent ? "text-danger" : "text-fg-1"
                  }`}
                >
                  {countdown}
                </p>
              )}
            </div>
          )}

          {lineupHref && !locked && (
            <Button
              onClick={() => router.push(lineupHref)}
              size="sm"
              className="shrink-0 self-start"
            >
              {hasLineup ? "Update lineup" : "Set lineup"}
            </Button>
          )}

          <button
            type="button"
            onClick={() =>
              router.push(`/user/${encodeURIComponent(userName || userId)}`)
            }
            className="shrink-0 rounded-full border border-white/10 p-0.5 transition-colors hover:border-accent/30"
            aria-label="Open public profile"
          >
            {avatar ? (
              <Image
                src={avatar}
                alt={`${userName} avatar`}
                width={34}
                height={34}
                sizes="34px"
                className="h-[34px] w-[34px] rounded-full object-cover"
              />
            ) : (
              <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent/10 font-display text-sm text-accent">
                {initial}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Band 2 — calm, deduped standing row */}
      {totalPoints && (
        <>
          <div className="my-5 h-px bg-white/6" />
          <div
            className={`flex flex-wrap items-start gap-x-8 gap-y-4 transition-opacity duration-200 ${
              isSwitching ? "opacity-50" : ""
            }`}
            aria-busy={statsLoading || isSwitching}
          >
            <StatCell
              value={totalPoints.value}
              label="Total points"
              loading={statsLoading}
              accent
            />
            {rank && (
              <StatCell
                value={rank.value}
                label="Rank"
                loading={statsLoading}
              />
            )}
            {gwPoints && (
              <StatCell
                value={gwPoints.value}
                label="This gameweek"
                loading={statsLoading}
              />
            )}
            {budget && (
              <StatCell
                value={budget.value}
                label="Budget"
                loading={statsLoading}
              />
            )}
            {pointsDeducted > 0 && (
              <div className="min-w-0">
                <p className="num font-display text-3xl leading-none tracking-[-0.02em] text-danger">
                  −{pointsDeducted.toFixed(0)}
                </p>
                <p className="mt-2 text-xs text-fg-3">Points deducted</p>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}
