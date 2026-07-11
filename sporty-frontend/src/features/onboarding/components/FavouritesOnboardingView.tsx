"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FavouritesForm } from "@/components/dashboard/profile/components/FavouritesForm";
import { useMe } from "@/hooks/auth/useMe";
import {
  useRemoveFavouritePlayer,
  useRemoveFavouriteTeam,
  useSetFavouritePlayer,
  useSetFavouriteTeam,
} from "@/hooks/users/useUsers";
import { getSafeRedirectPath } from "@/lib/route.utils";
import { toastifier } from "@/lib/toastifier";
import type { TTeamBrief } from "@/services/PlayerService";
import type { TFavouritePlayer } from "@/services/UserService";

type SportName = "football" | "basketball";

export function FavouritesOnboardingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: me } = useMe();
  const setFavouriteTeam = useSetFavouriteTeam(me?.id ?? "");
  const removeFavouriteTeam = useRemoveFavouriteTeam(me?.id ?? "");
  const setFavouritePlayer = useSetFavouritePlayer(me?.id ?? "");
  const removeFavouritePlayer = useRemoveFavouritePlayer(me?.id ?? "");

  const continuePath =
    getSafeRedirectPath(searchParams.get("redirect")) ?? "/dashboard";

  const handleTeamChange = async (sport: SportName, team: TTeamBrief) => {
    if (!me?.id) return;
    try {
      await setFavouriteTeam.mutateAsync({ sportName: sport, teamId: team.id });
    } catch {
      toastifier.error("✕ Unable to save favourite team");
    }
  };

  const handleTeamClear = async (sport: SportName) => {
    if (!me?.id) return;
    try {
      await removeFavouriteTeam.mutateAsync(sport);
    } catch {
      toastifier.error("✕ Unable to clear favourite team");
    }
  };

  const handlePlayerChange = async (sport: SportName, player: TFavouritePlayer) => {
    if (!me?.id) return;
    try {
      await setFavouritePlayer.mutateAsync({ sportName: sport, playerId: player.id });
    } catch {
      toastifier.error("✕ Unable to save favourite player");
    }
  };

  const handlePlayerClear = async (sport: SportName) => {
    if (!me?.id) return;
    try {
      await removeFavouritePlayer.mutateAsync(sport);
    } catch {
      toastifier.error("✕ Unable to clear favourite player");
    }
  };

  return (
    <section className="mx-auto max-w-lg space-y-6 px-6 py-12 text-[#f0f0f0]">
      <div>
        <p className="section-label">Welcome to Sporty</p>
        <h1 className="mt-2 font-bebas text-4xl tracking-[2px] text-[#f0f0f0] sm:text-5xl">
          Pick your favourites
        </h1>
        <p className="mt-2 text-sm text-[#9a9aa5]">
          Follow a team and player in each sport to get notified the moment
          they score. You can change this anytime in Profile Settings.
        </p>
      </div>

      <FavouritesForm
        favouriteTeams={me?.favourite_teams ?? []}
        favouritePlayers={me?.favourite_players ?? []}
        onTeamChange={handleTeamChange}
        onTeamClear={handleTeamClear}
        onPlayerChange={handlePlayerChange}
        onPlayerClear={handlePlayerClear}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => router.replace(continuePath)}
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-8 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0] sm:w-auto"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={() => router.replace(continuePath)}
          className="w-full rounded-[3px] bg-[#e8fb25] px-8 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#0a0a0f] transition-colors hover:bg-[#f0ff45] sm:w-auto"
        >
          Continue
        </button>
      </div>
    </section>
  );
}
