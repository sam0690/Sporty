import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
