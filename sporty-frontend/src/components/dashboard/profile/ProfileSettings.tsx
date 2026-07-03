"use client";

import { ProfileSettingsView, useProfileDashboard } from "@/features/profile";

export function ProfileSettings() {
  const vm = useProfileDashboard();
  return <ProfileSettingsView {...vm} />;
}
