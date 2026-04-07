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
import { useUser } from "@/hooks/users/useUsers";

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

export function UserProfile({ userId }: { userId?: string }) {
  const { data: me, username } = useMe();
  const { data: profileUser } = useUser(userId ?? "");
  const { data: leagues } = useMyLeagues();

  const mappedLeagues = useMemo<LeagueRow[]>(
    () =>
      (leagues ?? []).map((league, index) => ({
        id: index + 1,
        name: league.name,
        sport:
          (league.sports?.[0]?.sport.name as
            | "football"
            | "basketball"
            | "cricket") || "football",
        rank: league.my_team?.rank ?? 0,
        points: Number(league.my_team?.points ?? 0),
      })),
    [leagues],
  );

  const profile = useMemo(() => {
    return {
      ...mockProfile,
      id: profileUser?.id ?? me?.id ?? mockProfile.id,
      name: (profileUser?.username ?? username) || mockProfile.name,
      avatar: profileUser?.avatar_url ?? me?.avatar_url ?? mockProfile.avatar,
      joinDate:
        profileUser?.created_at ?? me?.created_at ?? mockProfile.joinDate,
      bio: "Public profile",
      totalLeagues: mappedLeagues.length,
      leagues: mappedLeagues,
    };
  }, [
    mappedLeagues,
    me?.avatar_url,
    me?.created_at,
    me?.id,
    profileUser?.avatar_url,
    profileUser?.created_at,
    profileUser?.id,
    profileUser?.username,
    username,
  ]);

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-8 font-[system-ui,-apple-system] text-gray-900">
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
