"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useMe } from "@/hooks/auth/useMe";
import { toastifier } from "@/lib/toastifier";
import { AvatarUpload } from "@/components/dashboard/profile/components/AvatarUpload";
import { DangerZone } from "@/components/dashboard/profile/components/DangerZone";
import { FavouritesForm } from "@/components/dashboard/profile/components/FavouritesForm";
import {
  ProfileForm,
  type ProfileUser,
} from "@/components/dashboard/profile/components/ProfileForm";
import { ProfileHeader } from "@/components/dashboard/profile/components/ProfileHeader";
import { SettingsSkeleton } from "@/components/dashboard/profile/components/SettingsSkeleton";
import {
  useRemoveFavouritePlayer,
  useRemoveFavouriteTeam,
  useSetFavouritePlayer,
  useSetFavouriteTeam,
  useUpdateUser,
  useUploadAvatar,
} from "@/hooks/users/useUsers";
import { UserService } from "@/services/UserService";
import type { TTeamBrief } from "@/services/PlayerService";
import type { TFavouritePlayer } from "@/services/UserService";

type SportName = "football" | "basketball";

const mockUser = {
  id: "1",
  name: "John Doe",
  email: "john@example.com",
  avatar: "",
  bio: "Fantasy sports enthusiast since 2020",
};

type ExtendedUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
};

export function ProfileSettingsView() {
  const { logout } = useAuth();
  const { data: me, username } = useMe();
  const updateUser = useUpdateUser(me?.id ?? "");
  const uploadAvatar = useUploadAvatar(me?.id ?? "");
  const setFavouriteTeam = useSetFavouriteTeam(me?.id ?? "");
  const removeFavouriteTeam = useRemoveFavouriteTeam(me?.id ?? "");
  const setFavouritePlayer = useSetFavouritePlayer(me?.id ?? "");
  const removeFavouritePlayer = useRemoveFavouritePlayer(me?.id ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  // Everything except bio is derived from the `me` query (mutations invalidate
  // it), so only bio lives in local state — the backend has no bio field.
  const [bio, setBio] = useState(mockUser.bio);
  const userData: ExtendedUser = {
    id: me?.id ?? mockUser.id,
    name: username || mockUser.name,
    email: me?.email ?? mockUser.email,
    avatar: me?.avatar_url ?? mockUser.avatar,
    bio,
  };
  useEffect(() => {
    const timeout = window.setTimeout(() => setIsLoading(false), 450);
    return () => window.clearTimeout(timeout);
  }, []);

  const profileFormUser: ProfileUser = useMemo(
    () => ({
      name: userData.name,
      email: userData.email,
      bio: userData.bio,
    }),
    [userData.name, userData.email, userData.bio],
  );

  const handleUpdateProfile = async (
    nextUser: ProfileUser,
  ): Promise<boolean> => {
    try {
      if (me?.id) {
        await updateUser.mutateAsync({
          username: nextUser.name,
        });
      }
      setBio(nextUser.bio);
      return true;
    } catch {
      toastifier.error("✕ Unable to update profile");
      return false;
    }
  };

  const handleTeamChange = async (sport: SportName, team: TTeamBrief): Promise<void> => {
    if (!me?.id) {
      return;
    }
    try {
      await setFavouriteTeam.mutateAsync({ sportName: sport, teamId: team.id });
    } catch {
      toastifier.error("✕ Unable to update favourite team");
    }
  };

  const handleTeamClear = async (sport: SportName): Promise<void> => {
    if (!me?.id) {
      return;
    }
    try {
      await removeFavouriteTeam.mutateAsync(sport);
    } catch {
      toastifier.error("✕ Unable to clear favourite team");
    }
  };

  const handlePlayerChange = async (sport: SportName, player: TFavouritePlayer): Promise<void> => {
    if (!me?.id) {
      return;
    }
    try {
      await setFavouritePlayer.mutateAsync({ sportName: sport, playerId: player.id });
    } catch {
      toastifier.error("✕ Unable to update favourite player");
    }
  };

  const handlePlayerClear = async (sport: SportName): Promise<void> => {
    if (!me?.id) {
      return;
    }
    try {
      await removeFavouritePlayer.mutateAsync(sport);
    } catch {
      toastifier.error("✕ Unable to clear favourite player");
    }
  };

  const handleAvatarChange = async (file: File): Promise<void> => {
    if (!me?.id) {
      return;
    }
    await uploadAvatar.mutateAsync(file);
  };

  const handleDeleteAccount = async (): Promise<boolean> => {
    try {
      setIsDeleting(true);
      if (me?.id) {
        await UserService.deleteUser(me.id);
      }
      const result = await logout();
      if (!result.success) {
        toastifier.error(`✕ ${result.error ?? "Unable to delete account"}`);
        return false;
      }

      toastifier.success("✓ Account deleted successfully");
      return true;
    } catch {
      toastifier.error("✕ Unable to delete account");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-8 text-[#f0f0f0]">
      <ProfileHeader
        userName={userData.name}
        userEmail={userData.email}
        avatarUrl={userData.avatar}
      />

      <div className="mt-6 space-y-6">
        <AvatarUpload
          currentAvatar={userData.avatar}
          onAvatarChange={handleAvatarChange}
        />

        <ProfileForm user={profileFormUser} onUpdate={handleUpdateProfile} />
        <FavouritesForm
          favouriteTeams={me?.favourite_teams ?? []}
          favouritePlayers={me?.favourite_players ?? []}
          onTeamChange={handleTeamChange}
          onTeamClear={handleTeamClear}
          onPlayerChange={handlePlayerChange}
          onPlayerClear={handlePlayerClear}
        />
        <DangerZone onDeleteAccount={handleDeleteAccount} />
      </div>

      {isDeleting ? (
        <p className="mt-4 text-sm text-[#555560]">
          Processing account deletion...
        </p>
      ) : null}
    </section>
  );
}
