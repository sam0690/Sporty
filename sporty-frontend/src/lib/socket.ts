const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export function buildMatchSocketUrl(matchId: string): string {
  const url = new URL(
    `${WS_BASE.replace(/^http/, "ws")}/api/ws/match/${matchId}`,
  );
  return url.toString();
}
