"use client";

import { ProfileSettingsView, useProfileDashboard } from "@/features/profile";

export default function ProfilePage() {
  const vm = useProfileDashboard();
  return <ProfileSettingsView {...vm} />;
}
