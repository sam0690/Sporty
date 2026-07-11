"use client";

import { useState } from "react";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { AdminDataTable, type AdminColumn } from "@/components/dashboard/admin/AdminDataTable";
import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { Pagination } from "@/components/dashboard/admin/Pagination";
import { useAdminAuditLog } from "@/hooks/admin/useAdminAuditLog";
import type { TAdminAuditLogEntry } from "@/services/AdminService";

const PAGE_SIZE = 25;

function formatAction(action: string): string {
  return action.replaceAll("_", " ");
}

export function AdminAuditLog() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useAdminAuditLog({ page, pageSize: PAGE_SIZE });

  const columns: AdminColumn<TAdminAuditLogEntry>[] = [
    {
      key: "created_at",
      header: "When",
      render: (e) => new Date(e.created_at).toLocaleString(),
    },
    { key: "actor", header: "Admin", render: (e) => e.actor_username_snapshot },
    {
      key: "action",
      header: "Action",
      render: (e) => <span className="uppercase tracking-[1px] text-xs">{formatAction(e.action)}</span>,
    },
    { key: "target", header: "Target", render: (e) => `${e.target_type}:${e.target_id.slice(0, 8)}` },
    { key: "reason", header: "Reason", render: (e) => e.reason ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Audit Log</h1>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <AdminErrorState onRetry={() => refetch()} />
      ) : data ? (
        <>
          <AdminDataTable
            columns={columns}
            rows={data.items}
            rowKey={(e) => e.id}
            emptyMessage="No admin actions recorded yet."
          />
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
