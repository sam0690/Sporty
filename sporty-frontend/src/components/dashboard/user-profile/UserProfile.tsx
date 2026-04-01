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
  recentActivity: [
    { type: "transfer", description: "Added Lionel Messi", date: "2025-03-30" },
    {
      type: "lineup",
      description: "Set lineup for Week 3",
      date: "2025-03-29",
    },
  ],
  topPlayers: [
    { name: "Nikola Jokic", points: 142, league: "NBA Fantasy 2025" },
    { name: "Lionel Messi", points: 87, league: "Premier League Champions" },
  ],
};

export function UserProfile() {
  const { data: me, username } = useMe();

  const profile = useMemo(() => {
    return {
      ...mockProfile,
      id: me?.id ?? mockProfile.id,
      name: username || mockProfile.name,
      avatar: me?.avatar_url ?? mockProfile.avatar,
      joinDate: me?.created_at ?? mockProfile.joinDate,
      bio: "Public profile",
    };
  }, [me?.avatar_url, me?.created_at, me?.id, username]);

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-8 text-gray-900 [font-family:system-ui,-apple-system]">
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm text-gray-500">Public Profile</p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-gray-900">
          {profile.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <ProfileHeader
            name={profile.name}
            avatar={profile.avatar}
            bio={profile.bio}
            joinDate={profile.joinDate}
          />
          <StatsCards
            totalPoints={profile.totalPoints}
            totalLeagues={profile.totalLeagues}
            bestRank={profile.bestRank}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <LeagueHistory leagues={profile.leagues} />
          <RecentActivity recentActivity={profile.recentActivity} />
          <PlayerHighlights topPlayers={profile.topPlayers} />
        </div>
      </div>
    </section>
  );
}
