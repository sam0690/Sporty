import type { MatchSnapshot } from "@/types/events";

// Realtime endpoints live under /api (not /api/v1), so use relative path
// that goes through the Next.js rewrite proxy.
const API_BASE = "";

export async function fetchMatchSnapshot(
  matchId: string,
): Promise<MatchSnapshot> {
  const response = await fetch(`${API_BASE}/api/match/${matchId}/state`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load match snapshot (${response.status})`);
  }

  return (await response.json()) as MatchSnapshot;
}
