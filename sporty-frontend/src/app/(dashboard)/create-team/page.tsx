"use client";

import { useLeagueRedirect } from "@/lib/useLeagueRedirect";
import { CardSkeleton } from "@/components/ui/skeletons";

export default function CreateTeamRedirectPage() {
  useLeagueRedirect("create-team");

  return (
    <div className="mx-auto max-w-6xl space-y-4 py-8">
      <CardSkeleton />
    </div>
  );
}
