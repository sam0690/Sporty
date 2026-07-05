import { useApiQuery } from "@/hooks/api/useApiQuery";
import { AdminService, type TAdminAuditLogListResponse } from "@/services/AdminService";

export function useAdminAuditLog(params?: { page?: number; pageSize?: number }) {
  return useApiQuery<TAdminAuditLogListResponse>(
    ["admin", "audit-log", params ?? {}],
    () => AdminService.getAuditLog(params),
  );
}
