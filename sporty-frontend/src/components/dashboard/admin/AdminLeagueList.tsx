"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { AdminDataTable, type AdminColumn } from "@/components/dashboard/admin/AdminDataTable";
import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { ConfirmDialog } from "@/components/dashboard/admin/ConfirmDialog";
import { Pagination } from "@/components/dashboard/admin/Pagination";
import { useAdminLeagues, useOverrideDeleteLeague } from "@/hooks/admin/useAdminLeagues";
import type { TAdminLeagueListItem } from "@/services/AdminService";

const PAGE_SIZE = 20;

export function AdminLeagueList() {
  const { user: currentAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TAdminLeagueListItem | null>(null);

  const { data, isLoading, isError, refetch } = useAdminLeagues({ page, pageSize: PAGE_SIZE, search: search || undefined });
  const deleteLeague = useOverrideDeleteLeague();

  const canDelete = hasMinRole(currentAdmin?.role, "super_admin");

  const columns: AdminColumn<TAdminLeagueListItem>[] = [
    { key: "name", header: "League", render: (l) => l.name },
    { key: "owner", header: "Owner", render: (l) => l.owner_username },
    {
      key: "status",
      header: "Status",
      render: (l) => <span className="uppercase tracking-[1px] text-xs">{l.status}</span>,
    },
    { key: "mode", header: "Mode", render: (l) => (l.draft_mode ? "Draft" : "Budget") },
    { key: "visibility", header: "Visibility", render: (l) => (l.is_public ? "Public" : "Private") },
    { key: "created_at", header: "Created", render: (l) => new Date(l.created_at).toLocaleDateString() },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (l) =>
        canDelete ? (
          <Button
            variant="danger"
            size="sm"
            disabled={deleteLeague.isPending}
            onClick={() => setDeleteTarget(l)}
          >
            Force Delete
          </Button>
        ) : (
          <span className="text-xs text-[#555560]">Super admin only</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-bebas text-4xl tracking-[2px] text-[#f0f0f0]">Leagues</h1>

      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search by league name…"
        className="w-full max-w-sm rounded-[3px] border border-[rgba(255,255,255,0.15)] bg-[#0d0d14] px-3 py-2 text-sm text-[#f0f0f0] placeholder:text-[#555560]"
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <AdminErrorState onRetry={() => refetch()} />
      ) : data ? (
        <>
          <AdminDataTable columns={columns} rows={data.items} rowKey={(l) => l.id} />
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            hasNext={data.has_next}
            onPageChange={setPage}
          />
        </>
      ) : null}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete League"
        message={`Force-delete league "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Force Delete"
        variant="danger"
        isPending={deleteLeague.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteLeague.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
      />
    </div>
  );
}
