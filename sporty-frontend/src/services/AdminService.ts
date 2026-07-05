import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";

export type TAdminUserListItem = {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type TAdminUserDetail = TAdminUserListItem & {
  auth_provider: string;
  avatar_url: string | null;
};

export type TAdminUserListResponse = {
  items: TAdminUserListItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
};

export type TAdminLeagueListItem = {
  id: string;
  name: string;
  status: string;
  owner_id: string;
  owner_username: string;
  is_public: boolean;
  draft_mode: boolean;
  created_at: string;
};

export type TAdminLeagueListResponse = {
  items: TAdminLeagueListItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
};

export type TAdminAuditLogEntry = {
  id: string;
  actor_user_id: string;
  actor_username_snapshot: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export type TAdminAuditLogListResponse = {
  items: TAdminAuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
};

export type TAdminUserListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
};

export type TAdminLeagueListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

/**
 * Admin service — platform-admin API calls (user/league oversight, audit log).
 * Every call requires the caller to hold at least the "support" admin role;
 * the backend enforces the exact tier per endpoint.
 */
export const AdminService = {
  async getUsers(params?: TAdminUserListParams): Promise<TAdminUserListResponse> {
    const res = await authApi.get(API_PATHS.ADMIN.USERS(params));
    return res.data;
  },

  async getUser(id: string): Promise<TAdminUserDetail> {
    const res = await authApi.get(API_PATHS.ADMIN.USER_DETAIL(id));
    return res.data;
  },

  async suspendUser(id: string, reason?: string): Promise<TAdminUserDetail> {
    const res = await authApi.post(API_PATHS.ADMIN.USER_SUSPEND(id), { reason });
    return res.data;
  },

  async reactivateUser(id: string, reason?: string): Promise<TAdminUserDetail> {
    const res = await authApi.post(API_PATHS.ADMIN.USER_REACTIVATE(id), { reason });
    return res.data;
  },

  async forceLogoutUser(id: string, reason?: string): Promise<{ revoked_count: number }> {
    const res = await authApi.post(API_PATHS.ADMIN.USER_FORCE_LOGOUT(id), { reason });
    return res.data;
  },

  async changeUserRole(id: string, role: string, reason?: string): Promise<TAdminUserDetail> {
    const res = await authApi.patch(API_PATHS.ADMIN.USER_ROLE(id), { role, reason });
    return res.data;
  },

  async getLeagues(params?: TAdminLeagueListParams): Promise<TAdminLeagueListResponse> {
    const res = await authApi.get(API_PATHS.ADMIN.LEAGUES(params));
    return res.data;
  },

  async overrideLeagueStatus(id: string, newStatus: string, reason?: string) {
    const res = await authApi.post(API_PATHS.ADMIN.LEAGUE_STATUS(id), {
      new_status: newStatus,
      reason,
    });
    return res.data;
  },

  async overrideDeleteLeague(id: string): Promise<void> {
    await authApi.delete(API_PATHS.ADMIN.LEAGUE_DELETE(id));
  },

  async overrideLeagueSettings(
    id: string,
    data: { name?: string; is_public?: boolean; reason?: string },
  ) {
    const res = await authApi.patch(API_PATHS.ADMIN.LEAGUE_SETTINGS(id), data);
    return res.data;
  },

  async getAuditLog(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<TAdminAuditLogListResponse> {
    const res = await authApi.get(API_PATHS.ADMIN.AUDIT_LOG(params));
    return res.data;
  },
};
