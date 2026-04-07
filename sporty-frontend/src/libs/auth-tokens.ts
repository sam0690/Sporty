import {
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage,
} from "@/libs/storage.local";
import { LocalStorageKeys } from "@/libs/storage.kyes";

let accessToken: string | null = null;

export const getAccessToken = (): string | null => {
  if (accessToken) {
    return accessToken;
  }

  const persistedToken = getLocalStorage(LocalStorageKeys.TOKEN);
  if (persistedToken) {
    accessToken = persistedToken;
  }

  return accessToken;
};

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  if (!token) {
    removeLocalStorage(LocalStorageKeys.TOKEN);
    return;
  }

  setLocalStorage(LocalStorageKeys.TOKEN, token);
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
