"use client";

import { use } from "react";
import { UserProfileView } from "@/features/user-profile";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  return <UserProfileView username={decodeURIComponent(username)} />;
}
