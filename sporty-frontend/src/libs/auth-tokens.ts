import {
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage,
} from "@/libs/storage.local";
import { LocalStorageKeys } from "@/libs/storage.kyes";

let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getRefreshToken = (): string | null => {
  return getLocalStorage(LocalStorageKeys.REFRESH_TOKEN);
};

export const setRefreshToken = (token: string | null): void => {
  if (!token) {
    removeLocalStorage(LocalStorageKeys.REFRESH_TOKEN);
    return;
  }

  setLocalStorage(LocalStorageKeys.REFRESH_TOKEN, token);
};

export const clearAuthTokens = (): void => {
  accessToken = null;
  removeLocalStorage(LocalStorageKeys.REFRESH_TOKEN);
  removeLocalStorage(LocalStorageKeys.TOKEN);
};
