"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useMe } from "@/hooks/auth/useMe";
import { toastifier } from "@/lib/toastifier";
import { AvatarUpload } from "@/components/dashboard/profile/components/AvatarUpload";
import { DangerZone } from "@/components/dashboard/profile/components/DangerZone";
import {
  ProfileForm,
  type ProfileUser,
} from "@/components/dashboard/profile/components/ProfileForm";
import { ProfileHeader } from "@/components/dashboard/profile/components/ProfileHeader";
import { SettingsSkeleton } from "@/components/dashboard/profile/components/SettingsSkeleton";
import { useUpdateUser } from "@/hooks/users/useUsers";
import { UserService } from "@/services/UserService";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userData, setUserData] = useState<ExtendedUser>({
    id: me?.id ?? mockUser.id,
    name: username || mockUser.name,
    email: me?.email ?? mockUser.email,
    avatar: me?.avatar_url ?? mockUser.avatar,
    bio: mockUser.bio,
  });
  useEffect(() => {
    const timeout = window.setTimeout(() => setIsLoading(false), 450);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    setUserData((prev) => ({
      ...prev,
      id: me?.id ?? prev.id,
      name: username || prev.name,
      email: me?.email ?? prev.email,
      avatar: me?.avatar_url ?? prev.avatar,
    }));
  }, [me?.avatar_url, me?.email, me?.id, username]);

  const profileFormUser: ProfileUser = useMemo(
    () => ({
      name: userData.name,
      email: userData.email,
      bio: userData.bio,
    }),
    [userData],
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
      setUserData((prev) => ({ ...prev, ...nextUser }));
      return true;
    } catch {
      toastifier.error("Unable to update profile");
      return false;
    }
  };

  const handleAvatarChange = async (avatar: string): Promise<void> => {
    if (me?.id) {
      await updateUser.mutateAsync({ avatar_url: avatar });
    }
    setUserData((prev) => ({ ...prev, avatar }));
    toastifier.success("Avatar updated successfully");
  };

  const handleDeleteAccount = async (): Promise<boolean> => {
    try {
      setIsDeleting(true);
      if (me?.id) {
        await UserService.deleteUser(me.id);
      }
      const result = await logout();
      if (!result.success) {
        toastifier.error(`${result.error ?? "Unable to delete account"}`);
        return false;
      }

      toastifier.success("Account deleted successfully");
      return true;
    } catch {
      toastifier.error("Unable to delete account");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-8 text-[#0B1220]">
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
        <DangerZone onDeleteAccount={handleDeleteAccount} />
      </div>

      {isDeleting ? (
        <p className="mt-4 text-sm text-[#6B7280]">
          Processing account deletion...
        </p>
      ) : null}
    </section>
  );
}
