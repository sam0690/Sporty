import type {
  MatchPrediction,
  MatchRatings,
  MatchSnapshot,
  ModelMetrics,
} from "@/types/events";

// Realtime endpoints live under /api (not /api/v1). They must hit the backend
// ORIGIN directly (not the Next.js rewrite proxy): auth is an httpOnly
// `access_token` cookie set on the backend domain by login, so a same-origin
// proxy request (Vercel domain) would not carry that cookie and 401s. Deriving
// the origin from NEXT_PUBLIC_API_URL (stripping /api/v1) mirrors socket.ts and
// sends the cookie cross-origin to the backend (CORS already allows credentials).
// Falls back to "" (same-origin proxy) for local dev where the var is unset.
function deriveApiOrigin(apiBase?: string): string {
  if (!apiBase) {
    return "";
  }
  return apiBase.replace(/\/api\/v1\/?$/, "");
}

const API_BASE = deriveApiOrigin(process.env.NEXT_PUBLIC_API_URL);

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

/** Global (not match-scoped) model-performance scorecard; 404 until the
 *  feeder has scored at least one finished match. */
export async function fetchModelMetrics(): Promise<ModelMetrics | null> {
  const response = await fetch(`${API_BASE}/api/model-metrics`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load model metrics (${response.status})`);
  }
  return (await response.json()) as ModelMetrics;
}
