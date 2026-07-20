"use client";

import { use } from "react";
import { UserProfileView, useUserProfileDashboard } from "@/features/user-profile";
import { idFromSlug } from "@/utils/profileSlug";

export default function UserProfilePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params);
  const vm = useUserProfileDashboard();
  return <UserProfileView {...vm} userId={idFromSlug(resolvedParams.id)} />;
}
