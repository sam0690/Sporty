"use client";

import { useMemo } from "react";

import { useMatchStore } from "@/store/matchStore";
import { matchIdentities } from "@/lib/teamIdentity";
import {
  buildStatLookup,
  deriveTeamTotals,
  displayValue,
  toNumber,
  visibleGroups,
  type StatValue,
} from "@/lib/matchTeamStats";
import { Panel } from "./Panel";
import { ChartIcon } from "./icons";

function StatRow({
  label,
  home,
  away,
  homeColor,
  awayColor,
}: {
  label: string;
  home: StatValue;
  away: StatValue;
  homeColor: string;
  awayColor: string;
}) {
  const numHome = toNumber(home) ?? 0;
  const numAway = toNumber(away) ?? 0;
  const total = numHome + numAway;
  // Even split when neither side registered the stat, so the bar reads as
  // "nothing to compare" rather than collapsing to one side.
  const homeShare = total > 0 ? (numHome / total) * 100 : 50;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-sm tabular-nums text-fg-1">
          {displayValue(home)}
        </span>
        <span className="text-center font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-2">
          {label}
        </span>
        <span className="font-display text-sm tabular-nums text-fg-1">
          {displayValue(away)}
        </span>
      </div>
      <div
        className="mt-1 flex h-1 overflow-hidden rounded-full bg-white/6"
        role="presentation"
      >
        <span
          className="h-full transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${homeShare}%`, background: homeColor }}
        />
        <span className="h-full flex-1" style={{ background: awayColor }} />
      </div>
    </li>
  );
}

export function TeamStatsCard() {
  const teamStats = useMatchStore((s) => s.teamStats);
  const playerBreakdowns = useMatchStore((s) => s.playerBreakdowns);
  const startingLineups = useMatchStore((s) => s.startingLineups);
  const players = useMatchStore((s) => s.players);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  // Defence has no counterpart in the provider's team sheet — those numbers
  // exist only per player, so we sum them ourselves.
  const { groups, lookup } = useMemo(() => {
    const derived = deriveTeamTotals(
      playerBreakdowns,
      startingLineups,
      players,
      homeTeam,
      awayTeam,
    );
    const merged = buildStatLookup(teamStats, derived);
    return { groups: visibleGroups(merged), lookup: merged };
  }, [teamStats, playerBreakdowns, startingLineups, players, homeTeam, awayTeam]);

  // Absent until full time, and for every non-football match — render nothing
  // rather than an empty card promising stats that aren't coming.
  if (groups.length === 0) return null;

  const { home, away } = matchIdentities(homeTeam ?? "Home", awayTeam ?? "Away");

  return (
    <Panel title="Match Stats" icon={<ChartIcon className="size-3.5" />}>
      <div className="mb-4 flex items-center justify-between font-sans text-[10px] font-700 uppercase tracking-[1px]">
        <span className="truncate" style={{ color: home.color }}>
          {homeTeam ?? "Home"}
        </span>
        <span className="truncate text-right" style={{ color: away.color }}>
          {awayTeam ?? "Away"}
        </span>
      </div>

      <div className="space-y-6">
        {groups.map((group) => {
          const headingId = `team-stats-${group.title.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <section key={group.title} aria-labelledby={headingId}>
              <h3 id={headingId} className="section-label mb-2.5 block text-fg-2">
                {group.title}
              </h3>
              <ul className="space-y-2.5">
                {group.rows.map((row) => (
                  <StatRow
                    key={`${group.title}:${row.key}`}
                    label={row.label}
                    home={lookup.home[row.key]}
                    away={lookup.away[row.key]}
                    homeColor={home.color}
                    awayColor={away.color}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
