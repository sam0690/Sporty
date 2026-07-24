/**
 * Storage keys for localStorage and sessionStorage.
 * 
 * IMPORTANT: Auth tokens are NOT stored in localStorage for security reasons.
 * Authentication uses httpOnly cookies only. See auth-context.tsx for the auth flow.
 */

export const LocalStorageKeys = {
  // Auth tokens removed - using httpOnly cookies only (security best practice)
  DASHBOARD_SELECTED_LEAGUE_ID: "dashboard_selected_league_id",
  FAVOURITES_NUDGE_DISMISSED: "favourites_nudge_dismissed",
  // Followed competitions on the fixtures page (JSON array of competition
  // names); pinned to the top of the league rail + fixtures list.
  FOLLOWED_LEAGUES: "followed_leagues",
} as const;

export const SessionStorageKeys = {
  REDIRECT_TO: "redirect_to",
} as const;