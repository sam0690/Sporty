"use client";

import { useState } from "react";
import Link from "next/link";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { AdminDataTable, type AdminColumn } from "@/components/dashboard/admin/AdminDataTable";
import { Pagination } from "@/components/dashboard/admin/Pagination";
import { useAdminTickets } from "@/hooks/admin/useAdminTickets";
import type { TAdminTicketListItem } from "@/services/AdminService";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["", "open", "in_progress", "waiting_on_user", "resolved", "closed"];

export function AdminTicketList() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useAdminTickets({ page, pageSize: PAGE_SIZE, status: statusFilter || undefined });

  const columns: AdminColumn<TAdminTicketListItem>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (t) => (
        <Link href={`/admin/tickets/${t.id}`} className="text-[#f0f0f0] hover:underline">
          {t.subject}
        </Link>
      ),
    },
    { key: "reporter", header: "Reporter", render: (t) => t.reporter_username },
    { key: "category", header: "Category", render: (t) => t.category.replaceAll("_", " ") },
    { key: "priority", header: "Priority", render: (t) => t.priority },
    { key: "status", header: "Status", render: (t) => <span className="uppercase tracking-[1px] text-xs">{t.status.replaceAll("_", " ")}</span> },
    { key: "assigned", header: "Assigned To", render: (t) => t.assigned_admin_username ?? "—" },
    { key: "created_at", header: "Opened", render: (t) => new Date(t.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-bebas text-4xl tracking-[2px] text-[#f0f0f0]">Tickets</h1>

      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
        className="rounded-[3px] border border-[rgba(255,255,255,0.15)] bg-[#0d0d14] px-3 py-2 text-sm text-[#f0f0f0]"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s ? s.replaceAll("_", " ") : "All statuses"}
          </option>
        ))}
      </select>

      {isLoading || !data ? (
        <TableSkeleton />
      ) : (
        <>
          <AdminDataTable columns={columns} rows={data.items} rowKey={(t) => t.id} emptyMessage="No tickets." />
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            hasNext={data.has_next}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
