/**
 * Storage keys for localStorage and sessionStorage.
 * 
 * IMPORTANT: Auth tokens are NOT stored in localStorage for security reasons.
 * Authentication uses httpOnly cookies only. See auth-context.tsx for the auth flow.
 */

export const LocalStorageKeys = {
  // Auth tokens removed - using httpOnly cookies only (security best practice)
  DASHBOARD_SELECTED_LEAGUE_ID: "dashboard_selected_league_id",
} as const;

export const SessionStorageKeys = {
  REDIRECT_TO: "redirect_to",
} as const;