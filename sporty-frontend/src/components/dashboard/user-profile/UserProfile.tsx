"use client";

import { useMemo } from "react";
import {
  LeagueHistory,
  type LeagueRow,
} from "@/components/dashboard/user-profile/components/LeagueHistory";
import {
  PlayerHighlights,
  type TopPlayer,
} from "@/components/dashboard/user-profile/components/PlayerHighlights";
import { ProfileHeader } from "@/components/dashboard/user-profile/components/ProfileHeader";
import {
  RecentActivity,
  type Activity,
} from "@/components/dashboard/user-profile/components/RecentActivity";
import { StatsCards } from "@/components/dashboard/user-profile/components/StatsCards";
import { useMe } from "@/hooks/auth/useMe";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import { useUser, useUserActivity } from "@/hooks/users/useUsers";

type PublicProfile = {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  joinDate: string;
  totalPoints: number;
  totalLeagues: number;
  bestRank: number;
  leagues: LeagueRow[];
  recentActivity: Activity[];
  topPlayers: TopPlayer[];
};

const mockProfile: PublicProfile = {
  id: "1",
  name: "John Doe",
  avatar: "",
  bio: "Fantasy sports enthusiast since 2020",
  joinDate: "2025-01-01",
  totalPoints: 587,
  totalLeagues: 3,
  bestRank: 1,
  leagues: [
    {
      id: 1,
      name: "Premier League Champions",
      sport: "football",
      rank: 3,
      points: 212,
    },
    {
      id: 2,
      name: "NBA Fantasy 2025",
      sport: "basketball",
      rank: 1,
      points: 642,
    },
    {
      id: 3,
      name: "Cricket World Cup",
      sport: "cricket",
      rank: 7,
      points: 387,
    },
  ],
  recentActivity: [],
  topPlayers: [
    { name: "Nikola Jokic", points: 142, league: "NBA Fantasy 2025" },
    { name: "Lionel Messi", points: 87, league: "Premier League Champions" },
  ],
};

import { UserProfileView, useUserProfileDashboard } from "@/features/user-profile";

export function UserProfile(props: { userId?: string }) {
  const vm = useUserProfileDashboard();
  return <UserProfileView {...vm} {...props} />;
}
