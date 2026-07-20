"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { useRelativeTime } from "@/hooks/general/useRelativeTime";
import {
  COUNTDOWN_URGENT_MS,
  formatCountdown,
} from "@/features/dashboard/lib/countdown";
import type { LeagueOption, MyTeamPlayerView } from "../types";

type SquadSpineProps = {
  leagueOptions: LeagueOption[];
  activeLeague: LeagueOption | null;
  teamName?: string;
  players: MyTeamPlayerView[];
  rank: number | null;
  seasonPoints: number;
  lineupDeadlineAt: string | null;
  hasLineup: boolean;
  live: boolean;
  isSwitching: boolean;
  onLeagueChange: (leagueId: string) => void;
};

function StatCell({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={`num font-display text-3xl leading-none tracking-[-0.02em] ${
          accent ? "text-accent" : "text-fg-1"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-fg-3">{label}</p>
    </div>
  );
}

export function SquadSpine({
  leagueOptions,
  activeLeague,
  teamName,
  players,
  rank,
  seasonPoints,
  lineupDeadlineAt,
  hasLineup,
  live,
  isSwitching,
  onLeagueChange,
}: SquadSpineProps) {
  const router = useRouter();
  const nowMs = useRelativeTime({ refreshIntervalMs: 30_000 });

  const deadlineMs = lineupDeadlineAt
    ? new Date(lineupDeadlineAt).getTime()
    : null;
  const isPast = deadlineMs != null && deadlineMs <= nowMs;
  // "Locked" = the upcoming XI window has closed; live = a gameweek is playing.
  const locked = live || isPast;
  const urgent =
    !locked && deadlineMs != null && deadlineMs - nowMs < COUNTDOWN_URGENT_MS;
  const countdown = deadlineMs ? formatCountdown(deadlineMs, nowMs) : "";

  const lineupHref = activeLeague
    ? `/leagues/${activeLeague.id}/lineup`
    : null;

  const squadValue = players.reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
  const gwPoints = players.reduce((sum, p) => sum + p.gameweekPoints, 0);

  const showSwitcher = leagueOptions.length > 1;

  return (
    <header className="overflow-hidden card-surface px-5 py-5 sm:px-7 sm:py-6">
      {/* Band 1 — who + what to do next */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
        <div className="min-w-0">
          <p className="section-label">{activeLeague?.name ?? "Your squad"}</p>
          <h1 className="mt-1.5 truncate font-display text-3xl leading-none tracking-[-0.02em] text-fg-1 sm:text-4xl">
            {teamName ?? "My Team"}
          </h1>

          {showSwitcher && (
            <div className="mt-3.5">
              {leagueOptions.length <= 4 ? (
                <div className="flex flex-wrap gap-2">
                  {leagueOptions.map((league) => {
                    const isActive = league.id === activeLeague?.id;
                    return (
                      <button
                        key={league.id}
                        type="button"
                        onClick={() => onLeagueChange(league.id)}
                        aria-pressed={isActive}
                        className={`rounded-[3px] border px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[0.5px] transition-colors ${
                          isActive
                            ? "border-accent/35 bg-accent/8 text-accent"
                            : "border-white/8 bg-surface-1 text-fg-2 hover:border-white/16 hover:text-fg-1"
                        }`}
                      >
                        {league.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="max-w-xs">
                  <Select
                    aria-label="Select league"
                    value={activeLeague?.id ?? ""}
                    onChange={onLeagueChange}
                    className="w-full"
                    options={leagueOptions.map((league) => ({
                      value: league.id,
                      label: league.label,
                    }))}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {activeLeague && deadlineMs != null && (
          <div className="flex items-start gap-4">
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

            {lineupHref &&
              (locked ? (
                <Link
                  href={lineupHref}
                  className="group mt-0.5 flex shrink-0 items-center gap-1 self-start rounded-[3px] px-2 py-1.5 text-sm font-600 text-fg-3 transition-colors hover:text-accent"
                >
                  View pitch
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0 self-start"
                  onClick={() => router.push(lineupHref)}
                >
                  {hasLineup ? "Update lineup" : "Set lineup"}
                </Button>
              ))}
          </div>
        )}
      </div>

      {/* Band 2 — calm standing row */}
      <div className="my-5 h-px bg-white/6" />
      <div
        className={`flex flex-wrap items-start gap-x-8 gap-y-4 transition-opacity duration-200 ${
          isSwitching ? "opacity-50" : ""
        }`}
        aria-busy={isSwitching}
      >
        <StatCell value={String(Math.round(seasonPoints))} label="Total points" accent />
        <StatCell value={rank ? `#${rank}` : "—"} label="Rank" />
        <StatCell value={`£${squadValue.toFixed(1)}M`} label="Squad value" />
        <StatCell
          value={gwPoints > 0 ? `+${Math.round(gwPoints)}` : String(Math.round(gwPoints))}
          label="This gameweek"
        />
      </div>
    </header>
  );
}
