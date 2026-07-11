"use client";

import { UserProfileView, useUserProfileDashboard } from "@/features/user-profile";

export function UserProfile(props: { userId?: string }) {
  const vm = useUserProfileDashboard();
  return <UserProfileView {...vm} {...props} />;
}
