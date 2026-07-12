import { authApi } from "@/api/auth-api-client";
import { publicApi } from "@/api/public-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { ApiResponse } from "@/types";
import type { AxiosResponse } from "axios";

export type TSportBrief = {
  name: string;
  display_name: string;
};

export type TFavouriteTeam = {
  id: string;
  name: string;
  logo_url: string | null;
  sport: TSportBrief;
};

export type TFavouritePlayer = {
  id: string;
  name: string;
  position: string;
  real_team: string;
  photo_url: string | null;
  real_team_logo_url: string | null;
  cost: number;
  sport: TSportBrief;
};

export type TMe = {
  id: string;
  username: string;
  email: string;
  auth_provider: string;
  google_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  role: string;
  email_notifications_enabled: boolean;
  favourite_teams: TFavouriteTeam[];
  favourite_players: TFavouritePlayer[];
  created_at: string;
};

export type TUserProfile = TMe;

export type TUserActivityType =
  | "transfer"
  | "points"
  | "lineup"
  | "rank"
  | "league_joined"
  | "league_created";

export type TUserActivityItem = {
  id: string;
  type: TUserActivityType;
  title: string;
  description: string;
  timestamp: string;
  league: {
    id: string;
    name: string;
    sports: string[];
  };
  details: Record<string, unknown>;
};

export type TUserPublicLeague = {
  league_id: string | null;
  name: string;
  sport: string;
  rank: number | null;
  points: number;
};

export type TUserPublicStats = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  total_points: number;
  total_leagues: number;
  best_rank: number | null;
  leagues: TUserPublicLeague[];
};

export type TUsersListResponse = {
  items: TUserProfile[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
};

const unwrapResponseData = <T>(payload: T | ApiResponse<T>): T => {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    typeof (payload as ApiResponse<T>).data !== "undefined"
  ) {
    return (payload as ApiResponse<T>).data;
  }

  return payload as T;
};

/**
 * User service — handles all user-related API calls.
 */

export const UserService = {
  /** Get the currently authenticated user */
  async me(): Promise<TMe> {
    const res: AxiosResponse<ApiResponse<TMe> | TMe> = await authApi.get(
      API_PATHS.AUTH.ME,
    );
    return unwrapResponseData(res.data);
  },

  /** Login with credentials */
  async login(payload: {
    identifier: string;
    password: string;
  }): Promise<{ detail: string }> {
    const res = await publicApi.post(API_PATHS.AUTH.LOGIN, payload);
    return unwrapResponseData(res.data);
  },

  /** Register a new account */
  async register(payload: {
    username: string;
    email: string;
    password: string;
    auto_login?: boolean;
  }): Promise<{ detail: string } | TUserProfile> {
    const res = await publicApi.post(API_PATHS.AUTH.REGISTER, payload);
    return unwrapResponseData(res.data);
  },

  /** Logout */
  async logout(): Promise<void> {
    await authApi.post(API_PATHS.AUTH.LOGOUT);
  },

  async logoutAll(): Promise<{ detail: string }> {
    const res = await authApi.post(API_PATHS.AUTH.LOGOUT_ALL);
    return unwrapResponseData(res.data);
  },

  async loginWithGoogle(code: string): Promise<{ detail: string }> {
    const res = await publicApi.post(API_PATHS.AUTH.GOOGLE, {
      code,
    });
    return unwrapResponseData(res.data);
  },

  async linkGoogle(linkToken: string): Promise<{ detail: string }> {
    const res = await authApi.post(API_PATHS.AUTH.GOOGLE_LINK, {
      link_token: linkToken,
    });
    return unwrapResponseData(res.data);
  },

  async forgotPassword(email: string): Promise<{ detail: string }> {
    const res = await publicApi.post(API_PATHS.AUTH.FORGOT_PASSWORD, { email });
    return unwrapResponseData(res.data);
  },

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ detail: string }> {
    const res = await publicApi.post(API_PATHS.AUTH.RESET_PASSWORD, {
      token,
      new_password: newPassword,
    });
    return unwrapResponseData(res.data);
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ detail: string }> {
    const res = await authApi.post(API_PATHS.AUTH.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return unwrapResponseData(res.data);
  },

  async listUsers(params?: {
    page?: number;
    page_size?: number;
  }): Promise<TUsersListResponse> {
    const res = await authApi.get(API_PATHS.USERS.LIST, { params });
    return unwrapResponseData(res.data);
  },

  async getUser(id: string): Promise<TUserProfile> {
    const res = await authApi.get(API_PATHS.USERS.DETAIL(id));
    return unwrapResponseData(res.data);
  },

  async updateUser(
    id: string,
    payload: {
      username?: string;
      avatar_url?: string | null;
      email_notifications_enabled?: boolean;
    },
  ): Promise<TUserProfile> {
    const res = await authApi.patch(API_PATHS.USERS.UPDATE(id), payload);
    return unwrapResponseData(res.data);
  },

  /** Set (or replace) the current user's favourite team for a sport */
  async setFavouriteTeam(sportName: string, teamId: string): Promise<TUserProfile> {
    const res = await authApi.post(API_PATHS.USERS.FAVOURITE_TEAM(sportName), {
      team_id: teamId,
    });
    return unwrapResponseData(res.data);
  },

  /** Remove the current user's favourite team for a sport */
  async removeFavouriteTeam(sportName: string): Promise<TUserProfile> {
    const res = await authApi.delete(API_PATHS.USERS.FAVOURITE_TEAM(sportName));
    return unwrapResponseData(res.data);
  },

  /** Set (or replace) the current user's favourite player for a sport */
  async setFavouritePlayer(sportName: string, playerId: string): Promise<TUserProfile> {
    const res = await authApi.post(API_PATHS.USERS.FAVOURITE_PLAYER(sportName), {
      player_id: playerId,
    });
    return unwrapResponseData(res.data);
  },

  /** Remove the current user's favourite player for a sport */
  async removeFavouritePlayer(sportName: string): Promise<TUserProfile> {
    const res = await authApi.delete(API_PATHS.USERS.FAVOURITE_PLAYER(sportName));
    return unwrapResponseData(res.data);
  },

  async uploadAvatar(id: string, file: File): Promise<TUserProfile> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await authApi.post(API_PATHS.USERS.UPLOAD_AVATAR(id), formData, {
      headers: { "Content-Type": undefined },
    });
    return unwrapResponseData(res.data);
  },

  async deleteUser(id: string): Promise<void> {
    await authApi.delete(API_PATHS.USERS.DELETE(id));
  },

  async getUserPublicStats(id: string): Promise<TUserPublicStats> {
    const res = await authApi.get(API_PATHS.USERS.PUBLIC_STATS(id));
    return unwrapResponseData(res.data);
  },

  /** Same data as getUserPublicStats, no login required — for shareable
   * manager-profile links (/u/[id]). */
  async getPublicManagerStats(id: string): Promise<TUserPublicStats> {
    const res = await publicApi.get(API_PATHS.USERS.PUBLIC_MANAGER_STATS(id));
    return unwrapResponseData(res.data);
  },

  async getUserActivity(id: string): Promise<TUserActivityItem[]> {
    const res = await authApi.get(API_PATHS.USERS.ACTIVITY(id));
    return unwrapResponseData(res.data);
  },

  async getMyActivity(leagueId?: string): Promise<TUserActivityItem[]> {
    const res = await authApi.get(API_PATHS.USERS.ME_ACTIVITY, {
      params: leagueId ? { league_id: leagueId } : undefined,
    });
    return unwrapResponseData(res.data);
  },
};
