import type { MatchSnapshot } from "@/types/events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
