import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  AdminService,
  type TAdminUserDetail,
  type TAdminUserListParams,
  type TAdminUserListResponse,
} from "@/services/AdminService";

const USERS_KEY = (params?: TAdminUserListParams) => ["admin", "users", params ?? {}];

export function useAdminUsers(params?: TAdminUserListParams) {
  return useApiQuery<TAdminUserListResponse>(USERS_KEY(params), () =>
    AdminService.getUsers(params),
  );
}

export function useAdminUser(id: string) {
  return useApiQuery<TAdminUserDetail>(
    ["admin", "users", id],
    () => AdminService.getUser(id),
    { enabled: !!id },
  );
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useApiMutation<TAdminUserDetail, { id: string; reason?: string }>(
    ({ id, reason }) => AdminService.suspendUser(id, reason),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "users", id] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "User suspended",
    },
  );
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useApiMutation<TAdminUserDetail, { id: string; reason?: string }>(
    ({ id, reason }) => AdminService.reactivateUser(id, reason),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "users", id] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "User reactivated",
    },
  );
}

export function useForceLogoutUser() {
  const queryClient = useQueryClient();
  return useApiMutation<{ revoked_count: number }, { id: string; reason?: string }>(
    ({ id, reason }) => AdminService.forceLogoutUser(id, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "User logged out on all devices",
    },
  );
}

export function useChangeUserRole() {
  const queryClient = useQueryClient();
  return useApiMutation<
    TAdminUserDetail,
    { id: string; role: string; reason?: string }
  >(
    ({ id, role, reason }) => AdminService.changeUserRole(id, role, reason),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "users", id] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Role updated",
    },
  );
}
