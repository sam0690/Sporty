"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import { getLastActiveLeagueId } from "@/lib/storage.index";

/**
 * Resolves which league a retired global route (`/my-team`, `/transfers`)
 * should redirect into: an explicit `?leagueId=`, then the last-active
 * league, then the user's first league, then `/leagues` if they have none.
 */
export function useLeagueRedirect(destinationSegment: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: leagues, isLoading } = useMyLeagues();

  useEffect(() => {
    if (isLoading) return;

    const queryLeagueId = searchParams.get("leagueId");
    const leagueId =
      queryLeagueId || getLastActiveLeagueId() || leagues?.[0]?.id;

    router.replace(
      leagueId ? `/leagues/${leagueId}/${destinationSegment}` : "/leagues",
    );
  }, [isLoading, leagues, searchParams, router, destinationSegment]);
}
