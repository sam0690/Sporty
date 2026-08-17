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

/** Three columns, fixed on the outside so every label lands in the same place
 *  down the whole block. justify-between would let the label drift left and
 *  right with the width of the numbers beside it. */
const ROW_GRID = "grid grid-cols-[3.25rem_1fr_3.25rem] items-baseline gap-3";

function StatRow({
  label,
  home,
  away,
  homeColor,
  awayColor,
  headline = false,
}: {
  label: string;
  home: StatValue;
  away: StatValue;
  homeColor: string;
  awayColor: string;
  headline?: boolean;
}) {
  const numHome = toNumber(home) ?? 0;
  const numAway = toNumber(away) ?? 0;
  const total = numHome + numAway;
  // Even split when neither side registered the stat, so the bar reads as
  // "nothing to compare" rather than collapsing to one side.
  const homeShare = total > 0 ? (numHome / total) * 100 : 50;

  // The bigger number is the one the eye should land on. Level values get no
  // emphasis, so a 2–2 row doesn't fake a winner.
  const homeLeads = numHome > numAway;
  const awayLeads = numAway > numHome;
  const lead = "text-fg-1";
  const trail = "text-fg-2";

  const valueSize = headline ? "text-lg" : "text-sm";
  const barHeight = headline ? "h-1.5" : "h-1";

  return (
    <li>
      <div className={ROW_GRID}>
        <span
          className={`font-display ${valueSize} tabular-nums ${awayLeads ? trail : lead}`}
        >
          {displayValue(home)}
        </span>
        <span className="text-center font-sans text-[11px] font-600 text-fg-2">
          {label}
        </span>
        <span
          className={`text-right font-display ${valueSize} tabular-nums ${homeLeads ? trail : lead}`}
        >
          {displayValue(away)}
        </span>
      </div>
      {/* Two rounded segments with a hairline gap rather than one butt-jointed
          stripe — the gap is what makes the split legible at a glance. The
          trailing side recedes so the comparison reads without counting. */}
      <div className={`mt-1.5 flex ${barHeight} gap-[3px]`} role="presentation">
        <span
          className="rounded-full transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: `${homeShare}%`,
            background: homeColor,
            opacity: awayLeads ? 0.35 : 1,
          }}
        />
        <span
          className="flex-1 rounded-full transition-opacity duration-200 ease-out motion-reduce:transition-none"
          style={{ background: awayColor, opacity: homeLeads ? 0.35 : 1 }}
        />
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

  const headline = groups.find((group) => group.headline);
  const detailGroups = groups.filter((group) => !group.headline);
  const { home, away } = matchIdentities(homeTeam ?? "Home", awayTeam ?? "Away");

  return (
    <Panel title="Match Stats" icon={<ChartIcon className="size-3.5" />}>
      {/* A legend, not column headers: once rows sit in two or three columns,
          a single full-width "home … away" bar would claim an alignment that
          doesn't exist. Every row still reads home-left, away-right. */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/8 pb-4 font-sans text-[11px] font-700 uppercase tracking-[0.14em]">
        <span className="flex min-w-0 items-center gap-2" style={{ color: home.color }}>
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: home.color }}
          />
          <span className="truncate">{homeTeam ?? "Home"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2" style={{ color: away.color }}>
          <span className="truncate">{awayTeam ?? "Away"}</span>
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: away.color }}
          />
        </span>
      </div>

      {headline && (
        <section aria-label={headline.title} className="mb-7">
          {/* The two numbers that summarise a match, side by side across the
              full width rather than stacked at the top of a long column. */}
          <ul className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {headline.rows.map((row) => (
              <StatRow
                key={row.key}
                label={row.label}
                home={lookup.home[row.key]}
                away={lookup.away[row.key]}
                homeColor={home.color}
                awayColor={away.color}
                headline
              />
            ))}
          </ul>
        </section>
      )}

      {/* Detail groups flow across the panel instead of down one narrow
          column — at full width a single column left most of the card empty
          and turned the tab into two tall slabs. */}
      <div className="grid items-start gap-x-10 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
        {detailGroups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            {/* A rule-and-label divider reads as a data-section header. A
                stack of five centred uppercase eyebrows does not. */}
            <div className="mb-3 flex items-center gap-3">
              <h3 className="section-label shrink-0">{group.title}</h3>
              <span aria-hidden className="h-px flex-1 bg-white/8" />
            </div>
            <ul className="space-y-3">
              {group.rows.map((row) => (
                <StatRow
                  key={row.key}
                  label={row.label}
                  home={lookup.home[row.key]}
                  away={lookup.away[row.key]}
                  homeColor={home.color}
                  awayColor={away.color}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}
