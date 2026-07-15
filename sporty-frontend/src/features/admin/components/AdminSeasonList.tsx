"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, type TableColumn } from "@/components/ui";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { AdminErrorState } from "./AdminErrorState";
import { SeasonFormModal } from "./SeasonFormModal";
import { GenerateWindowsModal } from "./GenerateWindowsModal";
import { useAdminSeasons } from "@/hooks/admin/useAdminSeasons";
import { useSports } from "@/hooks/leagues/useLeagues";
import type { TAdminSeason } from "@/services/AdminService";

const statusTone: Record<TAdminSeason["status"], "success" | "accent" | "neutral"> = {
  running: "success",
  upcoming: "accent",
  finished: "neutral",
};

export function AdminSeasonList() {
  const { data, isLoading, isError, refetch } = useAdminSeasons();
  const { data: sports } = useSports();
  const [editTarget, setEditTarget] = useState<TAdminSeason | null>(null);
  const [creating, setCreating] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<TAdminSeason | null>(null);

  const sportName = useMemo(() => {
    const byId = new Map((sports ?? []).map((s) => [s.id, s.display_name]));
    // Prefer the backend-resolved name: /leagues/sports only lists
    // league-playable sports, so ids outside it (e.g. Cricket) used to
    // render as raw UUIDs here.
    return (season: { sport_id: string; sport_name?: string | null }) =>
      season.sport_name ?? byId.get(season.sport_id) ?? season.sport_id;
  }, [sports]);

  const rows = useMemo(() => {
    return [...(data ?? [])].sort((a, b) => {
      const sportCompare = sportName(a).localeCompare(sportName(b));
      return sportCompare !== 0 ? sportCompare : b.start_date.localeCompare(a.start_date);
    });
  }, [data, sportName]);

  const columns: TableColumn<TAdminSeason>[] = [
    { key: "sport", header: "Sport", render: (s) => sportName(s) },
    {
      key: "name",
      header: "Name",
      render: (s) =>
        s.name.startsWith("dataset-import") ? (
          <span className="inline-flex items-center gap-2">
            {s.name}
            <span
              title="Created automatically by the CSV dataset importer to anchor historical stat rows it couldn't match to a real season. Not a playable season — no league can use it, safe to ignore."
              className="cursor-help"
            >
              <Badge tone="neutral">Import artifact</Badge>
            </span>
          </span>
        ) : (
          s.name
        ),
    },
    { key: "label", header: "Label", render: (s) => s.label ?? <span className="text-fg-3">—</span> },
    { key: "start_date", header: "Start", render: (s) => new Date(s.start_date).toLocaleDateString() },
    { key: "end_date", header: "End", render: (s) => new Date(s.end_date).toLocaleDateString() },
    {
      key: "status",
      header: "Status",
      render: (s) => <Badge tone={statusTone[s.status]}>{s.status}</Badge>,
    },
    { key: "is_active", header: "Active", render: (s) => (s.is_active ? "Yes" : "No") },
    {
      key: "windows",
      header: "Windows",
      render: (s) =>
        s.total_windows > 0 || s.status === "finished" ? (
          s.total_windows
        ) : (
          <Badge tone="danger">None generated</Badge>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (s) => (
        <div className="flex justify-end gap-2">
          {s.total_windows === 0 && s.status !== "finished" ? (
            <Button variant="outline" size="sm" onClick={() => setGenerateTarget(s)}>
              Generate Windows
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setEditTarget(s)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Seasons</h1>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          Create Season
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <AdminErrorState onRetry={() => refetch()} />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(s) => s.id ?? s.name} />
      )}

      <SeasonFormModal isOpen={creating} mode="create" onClose={() => setCreating(false)} />
      <SeasonFormModal
        isOpen={!!editTarget}
        mode="edit"
        season={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
      />
      <GenerateWindowsModal
        isOpen={!!generateTarget}
        season={generateTarget ?? undefined}
        onClose={() => setGenerateTarget(null)}
      />
    </div>
  );
}
