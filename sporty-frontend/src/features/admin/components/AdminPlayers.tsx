"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { Table, type TableColumn } from "@/components/ui";
import { AdminErrorState } from "./AdminErrorState";
import { Pagination } from "./Pagination";
import { usePlayers, useRealTeams } from "@/hooks/players/usePlayers";
import { useEditPlayer, useTriggerRepricing } from "@/hooks/admin/useAdminPlayers";
import type { TPlayer } from "@/types";

const PAGE_SIZE = 20;

export function AdminPlayers() {
  const { user: currentAdmin } = useAuth();
  const canEditPlayers = hasMinRole(currentAdmin?.role, "super_admin");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editAvailable, setEditAvailable] = useState(true);
  const [lookbackWindows, setLookbackWindows] = useState(3);

  // include_unavailable: this is the screen where departed players get fixed,
  // so it must show the ones every gameplay view now hides.
  const { data, isLoading, isError, refetch } = usePlayers({
    search: search || undefined,
    page,
    page_size: PAGE_SIZE,
    include_unavailable: true,
  });
  const { data: teams } = useRealTeams();
  const editPlayer = useEditPlayer();
  const triggerRepricing = useTriggerRepricing();

  const startEdit = (player: TPlayer) => {
    setEditingId(player.id);
    setEditCost(String(player.current_cost));
    // The public player payload carries the club name, not its id; both come
    // from real_teams.name, so matching on it is exact.
    setEditTeamId(teams?.find((t) => t.name === player.real_team)?.id ?? "");
    setEditAvailable(player.is_available ?? true);
  };

  const saveEdit = (player: TPlayer) => {
    const cost = Number(editCost);
    editPlayer.mutate(
      {
        id: player.id,
        data: {
          cost: Number.isFinite(cost) ? cost : undefined,
          real_team_id: editTeamId || undefined,
          is_available: editAvailable,
        },
      },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const columns: TableColumn<TPlayer>[] = [
    { key: "name", header: "Player", render: (p) => p.display_name },
    { key: "position", header: "Position", render: (p) => p.position },
    {
      key: "team",
      header: "Team",
      render: (p) =>
        editingId === p.id ? (
          <select
            value={editTeamId}
            onChange={(e) => setEditTeamId(e.target.value)}
            aria-label="Real-world club"
            className="w-44 rounded-[3px] border border-white/15 bg-surface-2 px-2 py-1 text-xs text-fg-1"
          >
            {(teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        ) : (
          p.real_team
        ),
    },
    { key: "sport", header: "Sport", render: (p) => p.sport?.display_name ?? "" },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      render: (p) =>
        editingId === p.id ? (
          <input
            type="number"
            step="0.1"
            value={editCost}
            onChange={(e) => setEditCost(e.target.value)}
            className="w-20 rounded-[3px] border border-white/15 bg-surface-2 px-2 py-1 text-xs text-fg-1"
          />
        ) : (
          `£${p.current_cost.toFixed(1)}m`
        ),
    },
    {
      key: "available",
      header: "Available",
      render: (p) =>
        editingId === p.id ? (
          <input
            type="checkbox"
            checked={editAvailable}
            onChange={(e) => setEditAvailable(e.target.checked)}
            aria-label="Available for selection"
            className="size-4 accent-accent"
          />
        ) : p.is_available ? (
          "Yes"
        ) : (
          <span className="text-fg-3">No</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (p) =>
        canEditPlayers ? (
          editingId === p.id ? (
            <div className="flex justify-end gap-2">
              <Button variant="primary" size="sm" disabled={editPlayer.isPending} onClick={() => saveEdit(p)}>
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
              Edit
            </Button>
          )
        ) : (
          <span className="text-xs text-fg-3">Super admin only</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Players</h1>

      <section className="card-surface p-5 space-y-3">
        <p className="section-label">Repricing</p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-fg-3" htmlFor="lookback">
            Lookback windows
          </label>
          <input
            id="lookback"
            type="number"
            min={1}
            max={10}
            value={lookbackWindows}
            onChange={(e) => setLookbackWindows(Number(e.target.value))}
            className="w-20 rounded-[3px] border border-white/15 bg-surface-2 px-2 py-1 text-sm text-fg-1"
          />
          <Button
            variant="primary"
            size="sm"
            disabled={triggerRepricing.isPending}
            onClick={() => triggerRepricing.mutate({ lookbackWindows })}
          >
            Trigger Repricing
          </Button>
        </div>
      </section>

      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search players by name…"
        className="w-full max-w-sm rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3"
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <AdminErrorState onRetry={() => refetch()} />
      ) : data ? (
        <>
          <Table columns={columns} rows={data.items} rowKey={(p) => p.id} />
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            hasNext={data.has_next}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
