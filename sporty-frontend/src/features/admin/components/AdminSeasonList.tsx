"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, type TableColumn } from "@/components/ui";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { AdminErrorState } from "./AdminErrorState";
import { SeasonFormModal } from "./SeasonFormModal";
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

  const sportName = useMemo(() => {
    const byId = new Map((sports ?? []).map((s) => [s.id, s.display_name]));
    return (sportId: string) => byId.get(sportId) ?? sportId;
  }, [sports]);

  const rows = useMemo(() => {
    return [...(data ?? [])].sort((a, b) => {
      const sportCompare = sportName(a.sport_id).localeCompare(sportName(b.sport_id));
      return sportCompare !== 0 ? sportCompare : b.start_date.localeCompare(a.start_date);
    });
  }, [data, sportName]);

  const columns: TableColumn<TAdminSeason>[] = [
    { key: "sport", header: "Sport", render: (s) => sportName(s.sport_id) },
    { key: "name", header: "Name", render: (s) => s.name },
    { key: "start_date", header: "Start", render: (s) => new Date(s.start_date).toLocaleDateString() },
    { key: "end_date", header: "End", render: (s) => new Date(s.end_date).toLocaleDateString() },
    {
      key: "status",
      header: "Status",
      render: (s) => <Badge tone={statusTone[s.status]}>{s.status}</Badge>,
    },
    { key: "is_active", header: "Active", render: (s) => (s.is_active ? "Yes" : "No") },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (s) => (
        <Button variant="outline" size="sm" onClick={() => setEditTarget(s)}>
          Edit
        </Button>
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
    </div>
  );
}
