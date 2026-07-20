"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useMe } from "@/hooks/auth/useMe";
import { toastifier } from "@/lib/toastifier";
import { DangerZone } from "./DangerZone";
import { FavouritesForm } from "./FavouritesForm";
import {
  PreferencesForm,
  type Preferences,
} from "./PreferencesForm";
import {
  ProfileForm,
  type ProfileUser,
} from "./ProfileForm";
import { ProfileHeader } from "./ProfileHeader";
import { SettingsSkeleton } from "./SettingsSkeleton";
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

type ExtendedUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
};

export function ProfileSettingsView() {
  const { logout } = useAuth();
  const { data: me, username, isLoading } = useMe();
  const updateUser = useUpdateUser(me?.id ?? "");
  const uploadAvatar = useUploadAvatar(me?.id ?? "");
  const setFavouriteTeam = useSetFavouriteTeam(me?.id ?? "");
  const removeFavouriteTeam = useRemoveFavouriteTeam(me?.id ?? "");
  const setFavouritePlayer = useSetFavouritePlayer(me?.id ?? "");
  const removeFavouritePlayer = useRemoveFavouritePlayer(me?.id ?? "");
  const [isDeleting, setIsDeleting] = useState(false);
  // Everything except bio is derived from the `me` query (mutations invalidate
  // it), so only bio lives in local state — the backend has no bio field.
  const [bio, setBio] = useState("");
  const userData: ExtendedUser = {
    id: me?.id ?? "",
    name: username,
    email: me?.email ?? "",
    avatar: me?.avatar_url ?? "",
    bio,
  };

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

  const preferences: Preferences = {
    emailNotifications: me?.email_notifications_enabled ?? true,
  };

  const handleUpdatePreferences = async (next: Preferences): Promise<void> => {
    if (!me?.id) {
      return;
    }
    await updateUser.mutateAsync({
      email_notifications_enabled: next.emailNotifications,
    });
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
    <section className="mx-auto max-w-5xl px-6 py-8 text-fg-1">
      <div className="mb-6">
        <p className="section-label">Account</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.02em] text-fg-1 sm:text-5xl">
          Profile
        </h1>
        <p className="mt-1 text-sm text-fg-3">
          Manage your account, preferences, and favourites.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-8">
          <ProfileHeader
            userName={userData.name}
            userEmail={userData.email}
            avatarUrl={userData.avatar}
            memberSince={me?.created_at}
            onAvatarChange={handleAvatarChange}
          />
        </div>

        <div className="space-y-6">
          <ProfileForm user={profileFormUser} onUpdate={handleUpdateProfile} />
          <PreferencesForm
            preferences={preferences}
            onUpdate={handleUpdatePreferences}
          />
          <FavouritesForm
            favouriteTeams={me?.favourite_teams ?? []}
            favouritePlayers={me?.favourite_players ?? []}
            onTeamChange={handleTeamChange}
            onTeamClear={handleTeamClear}
            onPlayerChange={handlePlayerChange}
            onPlayerClear={handlePlayerClear}
          />
          <DangerZone onDeleteAccount={handleDeleteAccount} />

          {isDeleting ? (
            <p className="text-sm text-fg-3">Processing account deletion…</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
