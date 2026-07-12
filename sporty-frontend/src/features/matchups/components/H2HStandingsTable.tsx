"use client";

import { Table, type TableColumn } from "@/components/ui";
import type { TH2HStandingRow } from "@/types";

type H2HStandingsTableProps = {
  rows: TH2HStandingRow[];
  myTeamId?: string;
};

export function H2HStandingsTable({ rows, myTeamId }: H2HStandingsTableProps) {
  const columns: TableColumn<TH2HStandingRow>[] = [
    {
      key: "team",
      header: "Team",
      render: (r) => (
        <span className={r.fantasy_team_id === myTeamId ? "font-700 text-accent" : "text-fg-1"}>
          {r.team_name}
        </span>
      ),
    },
    { key: "record", header: "W-L-T", render: (r) => `${r.wins}-${r.losses}-${r.ties}` },
    { key: "points_for", header: "Points For", align: "right", render: (r) => Number(r.points_for).toFixed(1) },
    { key: "points_against", header: "Points Against", align: "right", render: (r) => Number(r.points_against).toFixed(1) },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(r) => r.fantasy_team_id}
      emptyMessage="No standings yet — check back after the first matchup finishes."
    />
  );
}
