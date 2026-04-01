import { authApi } from "@/api/auth-api-client";
import { publicApi } from "@/api/public-api-client";
import { API_PATHS } from "@/api/apiPath";
import type { ApiResponse } from "@/types";
import type { AxiosResponse } from "axios";

export type TMe = {
  id: string;
  username: string;
  email: string;
  auth_provider: string;
  google_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
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
    username: string;
    password: string;
  }): Promise<ApiResponse<{ access_token: string; refresh_token: string }>> {
    const res = await publicApi.post(API_PATHS.AUTH.LOGIN, payload);
    return res.data;
  },

  /** Register a new account */
  async register(payload: {
    username: string;
    email: string;
    password: string;
    auto_login?: boolean;
  }): Promise<ApiResponse<{ access_token: string; refresh_token: string }>> {
    const res = await publicApi.post(API_PATHS.AUTH.REGISTER, payload);
    return res.data;
  },

  /** Logout */
  async logout(): Promise<void> {
    await authApi.post(API_PATHS.AUTH.LOGOUT);
  },
};
