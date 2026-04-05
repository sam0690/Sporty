"use client";

import { use } from "react";
import { UserProfile } from "@/components/dashboard/user-profile";

export default function UserProfilePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params);
  return <UserProfile userId={resolvedParams.id} />;
}
