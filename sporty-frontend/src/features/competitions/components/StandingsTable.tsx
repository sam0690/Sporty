"use client";

import { CompetitionLogo } from "@/components/ui/CompetitionLogo";
import { isBasketballRow, type TStandingRow } from "@/types/competition";

function FormDots({ form }: { form?: string | null }) {
  if (!form) return null;
  const results = form.split(",").slice(-5);
  const color: Record<string, string> = {
    W: "bg-[oklch(0.72_0.17_150)]",
    D: "bg-fg-3",
    L: "bg-[oklch(0.63_0.2_25)]",
  };
  return (
    <div className="hidden items-center gap-1 md:flex">
      {results.map((r, i) => (
        <span
          key={i}
          title={r}
          className={`size-1.5 rounded-full ${color[r] ?? "bg-fg-3"}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/** ".714" — NBA convention drops the leading zero, and 1.000 keeps it. */
function winPct(value?: number) {
  if (value === undefined) return "—";
  return value >= 1 ? "1.000" : value.toFixed(3).slice(1);
}

/** Games back: the leader shows a dash, not "0.0". */
function gamesBehind(value?: number) {
  if (value === undefined) return "—";
  return value === 0 ? "—" : value.toFixed(1);
}

// Per-sport column definitions. Football's trailing "Pts" and basketball's
// trailing "GB" both render in the emphasised last column, so the two tables
// stay visually identical apart from the numbers in them.
const FOOTBALL_COLUMNS = ["P", "W", "D", "L", "GF", "GA", "GD"] as const;
const BASKETBALL_COLUMNS = ["W", "L", "PCT", "STRK"] as const;

function footballCells(row: TStandingRow) {
  const gd = row.goalDifference ?? 0;
  return [
    row.playedGames,
    row.won,
    row.draw ?? 0,
    row.lost,
    row.goalsFor ?? 0,
    row.goalsAgainst ?? 0,
    gd > 0 ? `+${gd}` : gd,
  ];
}

function basketballCells(row: TStandingRow) {
  return [row.won, row.lost, winPct(row.winPct), row.streak ?? "—"];
}

export function StandingsTable({
  table,
  tag,
  title,
}: {
  table: TStandingRow[];
  tag?: string;
  /** Group name ("East", "Atlantic"); falls back to a plain "Standings" head. */
  title?: string;
}) {
  const isBasketball = table.length > 0 && isBasketballRow(table[0]);
  const columns = isBasketball ? BASKETBALL_COLUMNS : FOOTBALL_COLUMNS;
  const lastColumn = isBasketball ? "GB" : "Pts";

  return (
    <div className="overflow-hidden card-surface">
      {(tag || title) && (
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          {tag && <CompetitionLogo tag={tag} className="size-5" />}
          <p className="section-label">{title ?? "Standings"}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left">
              <th className="px-3 py-2.5 text-right font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
                #
              </th>
              <th className="px-2 py-2.5 font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
                {isBasketball ? "Team" : "Club"}
              </th>
              {columns.map((h) => (
                <th
                  key={h}
                  className="px-2 py-2.5 text-center font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3"
                >
                  {h}
                </th>
              ))}
              <th className="hidden px-2 py-2.5 text-center font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3 md:table-cell">
                {isBasketball ? "L5" : "Form"}
              </th>
              <th className="px-3 py-2.5 text-right font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-2">
                {lastColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr
                key={row.team.id ?? row.position}
                className="border-b border-white/6 transition-colors last:border-b-0 hover:bg-white/3"
              >
                <td className="px-3 py-2.5 text-right tabular-nums text-fg-3">
                  {row.position}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {row.team.crest ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.team.crest}
                        alt=""
                        className="size-5 shrink-0 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="size-5 shrink-0 rounded-full bg-surface-3" />
                    )}
                    <span className="truncate font-500 text-fg-1">
                      {row.team.name}
                    </span>
                  </div>
                </td>
                {(isBasketball ? basketballCells(row) : footballCells(row)).map(
                  (v, i) => (
                    <td
                      key={i}
                      className="px-2 py-2.5 text-center tabular-nums text-fg-2"
                    >
                      {v}
                    </td>
                  ),
                )}
                <td className="hidden px-2 py-2.5 md:table-cell">
                  <div className="flex justify-center">
                    <FormDots form={row.form} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-700 tabular-nums text-fg-1">
                  {isBasketball ? gamesBehind(row.gamesBehind) : (row.points ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
