import type {
  MatchPrediction,
  MatchRatings,
  MatchSnapshot,
} from "@/types/events";

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

async function fetchOptionalMatchResource<T>(
  matchId: string,
  resource: "prediction" | "ratings",
): Promise<T | null> {
  const response = await fetch(
    `${API_BASE}/api/match/${matchId}/${resource}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    },
  );

  // 404 means the feeder has not pushed this resource (yet) — not an error.
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load match ${resource} (${response.status})`);
  }
  return (await response.json()) as T;
}

export function fetchMatchPrediction(
  matchId: string,
): Promise<MatchPrediction | null> {
  return fetchOptionalMatchResource<MatchPrediction>(matchId, "prediction");
}

export function fetchMatchRatings(
  matchId: string,
): Promise<MatchRatings | null> {
  return fetchOptionalMatchResource<MatchRatings>(matchId, "ratings");
}
