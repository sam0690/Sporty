import { LocalStorageKeys } from "./storage.keys";
import { getLocalStorage, setLocalStorage } from "./storage.local";

/**
 * "Last active league" reuses the dashboard's selected-league key so the
 * value users already have persisted keeps working.
 */
export function getLastActiveLeagueId(): string | null {
  return getLocalStorage(LocalStorageKeys.DASHBOARD_SELECTED_LEAGUE_ID);
}

export function setLastActiveLeagueId(leagueId: string): void {
  setLocalStorage(LocalStorageKeys.DASHBOARD_SELECTED_LEAGUE_ID, leagueId);
}
