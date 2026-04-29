import { getAccessToken } from "@/libs/auth-tokens";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export function buildMatchSocketUrl(matchId: string): string {
  const token = getAccessToken();
  const url = new URL(
    `${WS_BASE.replace(/^http/, "ws")}/api/ws/match/${matchId}`,
  );
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}
