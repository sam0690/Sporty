import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── API Rewrites (Development) ─────────────────────────────
  // Proxy /api/* requests to the FastAPI backend so that cookies
  // are sent as same-origin (avoids SameSite=Lax blocking cross-origin
  // POST/PUT/PATCH/DELETE requests in development).
  //
  // In production, the frontend and backend should share a domain
  // (e.g., app.sporty.com and api.sporty.com with COOKIE_DOMAIN=.sporty.com)
  // or be behind a reverse proxy that handles routing.
  async rewrites() {
    // Backend server URL (not the API path). Used to proxy /api/* requests.
    // Development: http://localhost:8000
    // Production: set BACKEND_SERVER_URL env var (e.g., https://api.sporty.com)
    const backendServerUrl = process.env.BACKEND_SERVER_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendServerUrl}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/league/:id",
        destination: "/leagues/:id",
        permanent: false,
      },
      {
        source: "/league/:id/lineup",
        destination: "/leagues/:id/lineup",
        permanent: false,
      },
      {
        source: "/league/:id/roster",
        destination: "/leagues/:id/roster",
        permanent: false,
      },
      {
        source: "/league/:id/leaderboard",
        destination: "/leagues/:id/leaderboard",
        permanent: false,
      },
      {
        source: "/league/:id/members",
        destination: "/leagues/:id/members",
        permanent: false,
      },
      {
        source: "/league/:id/invite",
        destination: "/leagues/:id/invite",
        permanent: false,
      },
      {
        source: "/league/:id/settings",
        destination: "/leagues/:id/settings",
        permanent: false,
      },
      {
        source: "/dashboard/leagues/:id/settings",
        destination: "/leagues/:id/settings",
        permanent: false,
      },
      {
        source: "/dashboard/league/:id/settings",
        destination: "/leagues/:id/settings",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
