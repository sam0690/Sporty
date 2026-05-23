"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useMe } from "@/hooks/auth/useMe";
import { toastifier } from "@/lib/toastifier";
import { AvatarUpload } from "@/components/dashboard/profile/components/AvatarUpload";
import { DangerZone } from "@/components/dashboard/profile/components/DangerZone";
// import { PasswordForm } from "@/components/dashboard/profile/components/PasswordForm";
import {
  PreferencesForm,
  type Preferences,
} from "@/components/dashboard/profile/components/PreferencesForm";
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

const mockPreferences: Preferences = {
  emailNotifications: true,
  pushNotifications: false,
  darkMode: false,
  language: "en",
};

type ExtendedUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
};

import { ProfileSettingsView, useProfileDashboard } from "@/features/profile";

export function ProfileSettings() {
  const vm = useProfileDashboard();
  return <ProfileSettingsView {...vm} />;
}
