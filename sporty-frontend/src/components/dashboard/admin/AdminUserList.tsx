"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { Table, type TableColumn } from "@/components/ui";
import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { Pagination } from "@/components/dashboard/admin/Pagination";
import {
  useAdminUsers,
  useSuspendUser,
  useReactivateUser,
  useForceLogoutUser,
  useChangeUserRole,
} from "@/hooks/admin/useAdminUsers";
import type { TAdminUserListItem } from "@/services/AdminService";

const PAGE_SIZE = 20;
const ROLE_OPTIONS = ["user", "support", "admin", "super_admin"];

export function AdminUserList() {
  const { user: currentAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useAdminUsers({ page, pageSize: PAGE_SIZE, search: search || undefined });
  const suspendUser = useSuspendUser();
  const reactivateUser = useReactivateUser();
  const forceLogoutUser = useForceLogoutUser();
  const changeUserRole = useChangeUserRole();

  const canChangeRoles = hasMinRole(currentAdmin?.role, "super_admin");

  const columns: TableColumn<TAdminUserListItem>[] = [
    { key: "username", header: "Username", render: (u) => u.username },
    { key: "email", header: "Email", render: (u) => u.email },
    {
      key: "role",
      header: "Role",
      render: (u) =>
        canChangeRoles ? (
          <select
            defaultValue={u.role}
            disabled={u.id === currentAdmin?.id}
            onChange={(e) =>
              changeUserRole.mutate({ id: u.id, role: e.target.value })
            }
            className="rounded-[3px] border border-white/15 bg-surface-2 px-2 py-1 text-xs uppercase tracking-[1px] text-fg-1"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        ) : (
          <span className="uppercase tracking-[1px] text-xs">{u.role}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span className={u.is_active ? "text-success" : "text-danger"}>
          {u.is_active ? "Active" : "Suspended"}
        </span>
      ),
    },
    { key: "created_at", header: "Joined", render: (u) => new Date(u.created_at).toLocaleDateString() },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (u) => (
        <div className="flex justify-end gap-2">
          {u.is_active ? (
            <Button
              variant="danger"
              size="sm"
              disabled={suspendUser.isPending}
              onClick={() => suspendUser.mutate({ id: u.id })}
            >
              Suspend
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={reactivateUser.isPending}
              onClick={() => reactivateUser.mutate({ id: u.id })}
            >
              Reactivate
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={forceLogoutUser.isPending}
            onClick={() => forceLogoutUser.mutate({ id: u.id })}
          >
            Force Logout
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Users</h1>

      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search by username or email…"
        className="w-full max-w-sm rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3"
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <AdminErrorState onRetry={() => refetch()} />
      ) : data ? (
        <>
          <Table columns={columns} rows={data.items} rowKey={(u) => u.id} />
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
