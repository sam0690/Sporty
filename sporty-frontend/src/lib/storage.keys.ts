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

/**
 * Per-team key for the user's saved pitch arrangement (lineup drag-and-drop
 * positions). Keyed by league + team — NOT by transfer window — so a manager's
 * preferred formation persists across gameweeks. Players removed via transfers
 * are pruned on load; new players fall back to the auto-generated layout.
 */
export function lineupPositionsKey(leagueId: string, teamId: string): string {
  return `lineup_positions:${leagueId}:${teamId}`;
}