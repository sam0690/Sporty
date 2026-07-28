function deriveWebSocketBase(apiBase?: string): string | undefined {
  if (!apiBase) {
    return undefined;
  }

  if (apiBase.startsWith("http://")) {
    return apiBase.replace(/^http:/, "ws:").replace(/\/api\/v1\/?$/, "");
  }

  if (apiBase.startsWith("https://")) {
    return apiBase.replace(/^https:/, "wss:").replace(/\/api\/v1\/?$/, "");
  }

  return undefined;
}

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  deriveWebSocketBase(process.env.NEXT_PUBLIC_API_URL);

if (!WS_BASE) {
  throw new Error(
    "NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_API_URL must be configured for websocket connections.",
  );
}

export function buildMatchSocketUrl(matchId: string): string {
  const wsBase = WS_BASE;
  if (!wsBase) {
    throw new Error(
      "NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_API_URL must be configured for websocket connections.",
    );
  }

  const url = new URL(
    `${wsBase.replace(/^http/, "ws")}/api/ws/match/${matchId}`,
  );
  return url.toString();
}

/** Global "live set changed" bell — the dashboard ticker subscribes here and
 *  refetches instead of polling. Data-free, but auth'd via the same short-lived
 *  ws-ticket as chat (the socket handshake carries no httpOnly cookie). */
export function buildLiveSocketUrl(ticket?: string): string {
  const wsBase = WS_BASE;
  if (!wsBase) {
    throw new Error(
      "NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_API_URL must be configured for websocket connections.",
    );
  }
  const url = new URL(`${wsBase.replace(/^http/, "ws")}/api/ws/live`);
  if (ticket) {
    url.searchParams.set("token", ticket);
  }
  return url.toString();
}

export function buildLeagueChatSocketUrl(leagueId: string, ticket?: string): string {
  const wsBase = WS_BASE;
  if (!wsBase) {
    throw new Error(
      "NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_API_URL must be configured for websocket connections.",
    );
  }

  const url = new URL(
    `${wsBase.replace(/^http/, "ws")}/api/ws/league/${leagueId}/chat`,
  );
  // Chat is the one authenticated socket. The handshake may not carry the
  // httpOnly cookie (sockets connect to the API host directly, while HTTP
  // goes through the same-origin proxy), so a short-lived ticket from
  // POST /auth/ws-ticket rides the query string instead.
  if (ticket) {
    url.searchParams.set("token", ticket);
  }
  return url.toString();
}
