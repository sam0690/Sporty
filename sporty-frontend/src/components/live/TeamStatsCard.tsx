"use client";

import { useMatchStore } from "@/store/matchStore";
import { matchIdentities } from "@/lib/teamIdentity";
import { Panel } from "./Panel";
import { ChartIcon } from "./icons";

// Which stats to show and in what order. The provider reports ~18 per team,
// most of which are noise next to each other (shots insidebox/outsidebox/
// blocked all restate Total Shots), so this is the readable subset. Keys are
// API-Football's own `type` strings — they arrive verbatim from the stat sheet.
const ROWS: ReadonlyArray<[key: string, label: string]> = [
  ["Ball Possession", "Possession"],
  ["Total Shots", "Shots"],
  ["Shots on Goal", "Shots on target"],
  ["expected_goals", "Expected goals"],
  ["Corner Kicks", "Corners"],
  ["Passes %", "Pass accuracy"],
  ["Fouls", "Fouls"],
  ["Offsides", "Offsides"],
  ["Goalkeeper Saves", "Saves"],
  ["Yellow Cards", "Yellow cards"],
  ["Red Cards", "Red cards"],
];

/** Provider values are raw: 8, "52%", 1.83, or null when not reported. Returns
 *  the number behind the value for bar widths, and the string for display. */
function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.endsWith("%")) {
    const parsed = Number(value.slice(0, -1));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return String(value);
}

export function TeamStatsCard() {
  const teamStats = useMatchStore((s) => s.teamStats);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  // Absent until full time, and for every non-football match — render nothing
  // rather than an empty card promising stats that aren't coming.
  if (!teamStats) return null;

  const rows = ROWS.filter(
    ([key]) =>
      teamStats.home?.[key] !== undefined || teamStats.away?.[key] !== undefined,
  );
  if (rows.length === 0) return null;

  const { home, away } = matchIdentities(homeTeam ?? "Home", awayTeam ?? "Away");

  return (
    <Panel title="Match Stats" icon={<ChartIcon className="size-3.5" />}>
      <div className="mb-3 flex items-center justify-between font-sans text-[10px] font-700 uppercase tracking-[1px]">
        <span className="truncate" style={{ color: home.color }}>
          {homeTeam ?? "Home"}
        </span>
        <span className="truncate text-right" style={{ color: away.color }}>
          {awayTeam ?? "Away"}
        </span>
      </div>

      <ul className="space-y-3">
        {rows.map(([key, label]) => {
          const rawHome = teamStats.home?.[key];
          const rawAway = teamStats.away?.[key];
          const numHome = toNumber(rawHome) ?? 0;
          const numAway = toNumber(rawAway) ?? 0;
          const total = numHome + numAway;
          // Even split when neither side registered the stat, so the bar reads
          // as "nothing to compare" rather than collapsing to one side.
          const homeShare = total > 0 ? (numHome / total) * 100 : 50;

          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-sm tabular-nums text-fg-1">
                  {display(rawHome)}
                </span>
                <span className="font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
                  {label}
                </span>
                <span className="font-display text-sm tabular-nums text-fg-1">
                  {display(rawAway)}
                </span>
              </div>
              <div
                className="mt-1 flex h-1 overflow-hidden rounded-full bg-white/6"
                role="presentation"
              >
                <span
                  className="h-full transition-[width] duration-500"
                  style={{ width: `${homeShare}%`, background: home.color }}
                />
                <span
                  className="h-full flex-1 transition-[width] duration-500"
                  style={{ background: away.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
