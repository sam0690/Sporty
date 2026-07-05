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

export type TScoringRecalculateResponse = {
  football_players_updated: number;
  cricket_players_updated: number;
  basketball_players_updated: number;
  skipped: boolean;
  reason: string | null;
};

export type TWindowLockResponse = {
  id: string;
  transfers_locked: boolean;
  lineup_locked: boolean;
};

export type TAdminPlayerDetail = {
  id: string;
  name: string;
  position: string;
  real_team: string;
  cost: number;
  is_available: boolean;
  photo_url: string | null;
};

export type TAdminPlayerEditRequest = {
  name?: string;
  position?: string;
  cost?: number;
  is_available?: boolean;
  photo_url?: string;
  reason?: string;
};

export type TRepriceResponse = {
  lookback_windows: number;
  evaluated: number;
  updated: number;
  unchanged: number;
};

export type TTradeActionResponse = {
  id: string;
  status: string;
};

export type TWaiverClaimCancelResponse = {
  id: string;
  status: string;
};

export type TTransferReverseResponse = {
  transfer_id: string;
  reversed: boolean;
};

export type TCeleryTaskInfo = {
  worker: string;
  task: string | null;
  id: string | null;
};

export type TCeleryBeatEntry = {
  name: string;
  task: string;
  schedule: string;
};

export type TCeleryJobsResponse = {
  workers_online: string[];
  active: TCeleryTaskInfo[];
  scheduled: TCeleryTaskInfo[];
  reserved: TCeleryTaskInfo[];
  beat_schedule: TCeleryBeatEntry[];
  locks_held: string[];
  inspect_reachable: boolean;
};

export type TKafkaWorkerStatus = {
  name: string;
  alive: boolean;
  last_seen_seconds_ago: number | null;
};

export type TKafkaJobsResponse = {
  workers: TKafkaWorkerStatus[];
};

export type TSystemConfigEntry = {
  key: string;
  value: { enabled?: boolean } & Record<string, unknown>;
  description: string | null;
  updated_by_user_id: string | null;
  updated_at: string;
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

  // ── Scoring ─────────────────────────────────────────────────────────────

  async recalculateWindowScore(leagueId: string, windowId: string, reason?: string) {
    const res = await authApi.post(API_PATHS.ADMIN.RECALCULATE_WINDOW_SCORE(leagueId, windowId), { reason });
    return res.data as TScoringRecalculateResponse;
  },

  async recalculateActiveWindows(reason?: string) {
    const res = await authApi.post(API_PATHS.ADMIN.RECALCULATE_ACTIVE_WINDOWS, { reason });
    return res.data as TScoringRecalculateResponse;
  },

  async setWindowLock(
    windowId: string,
    data: { transfers_locked?: boolean; lineup_locked?: boolean; reason?: string },
  ) {
    const res = await authApi.post(API_PATHS.ADMIN.WINDOW_LOCK(windowId), data);
    return res.data as TWindowLockResponse;
  },

  // ── Players / pricing ────────────────────────────────────────────────────

  async getPlayer(id: string): Promise<TAdminPlayerDetail> {
    const res = await authApi.get(API_PATHS.ADMIN.PLAYER_DETAIL(id));
    return res.data;
  },

  async editPlayer(id: string, data: TAdminPlayerEditRequest): Promise<TAdminPlayerDetail> {
    const res = await authApi.patch(API_PATHS.ADMIN.PLAYER_DETAIL(id), data);
    return res.data;
  },

  async triggerRepricing(lookbackWindows: number, reason?: string) {
    const res = await authApi.post(API_PATHS.ADMIN.PLAYER_REPRICE, {
      lookback_windows: lookbackWindows,
      reason,
    });
    return res.data as TRepriceResponse;
  },

  // ── Transactions (trades / waivers / transfers) ──────────────────────────

  async vetoTrade(leagueId: string, tradeId: string, reason?: string) {
    const res = await authApi.post(API_PATHS.ADMIN.TRADE_VETO(leagueId, tradeId), { reason });
    return res.data as TTradeActionResponse;
  },

  async cancelTrade(leagueId: string, tradeId: string, reason?: string) {
    const res = await authApi.post(API_PATHS.ADMIN.TRADE_CANCEL(leagueId, tradeId), { reason });
    return res.data as TTradeActionResponse;
  },

  async cancelWaiverClaim(leagueId: string, claimId: string, reason?: string) {
    const res = await authApi.post(API_PATHS.ADMIN.WAIVER_CANCEL(leagueId, claimId), { reason });
    return res.data as TWaiverClaimCancelResponse;
  },

  async reverseTransfer(transferId: string, reason?: string) {
    const res = await authApi.post(API_PATHS.ADMIN.TRANSFER_REVERSE(transferId), { reason });
    return res.data as TTransferReverseResponse;
  },

  // ── Job visibility ────────────────────────────────────────────────────────

  async getCeleryJobs(): Promise<TCeleryJobsResponse> {
    const res = await authApi.get(API_PATHS.ADMIN.JOBS_CELERY);
    return res.data;
  },

  async getKafkaJobs(): Promise<TKafkaJobsResponse> {
    const res = await authApi.get(API_PATHS.ADMIN.JOBS_KAFKA);
    return res.data;
  },

  // ── System config / feature flags ────────────────────────────────────────

  async getSystemConfig(): Promise<TSystemConfigEntry[]> {
    const res = await authApi.get(API_PATHS.ADMIN.CONFIG_LIST);
    return res.data;
  },

  async toggleRealtimePipeline(enabled: boolean, reason?: string): Promise<TSystemConfigEntry> {
    const res = await authApi.post(API_PATHS.ADMIN.CONFIG_REALTIME_PIPELINE, { enabled, reason });
    return res.data;
  },

  async toggleLivePolling(enabled: boolean, reason?: string): Promise<TSystemConfigEntry> {
    const res = await authApi.post(API_PATHS.ADMIN.CONFIG_LIVE_POLLING, { enabled, reason });
    return res.data;
  },
};
