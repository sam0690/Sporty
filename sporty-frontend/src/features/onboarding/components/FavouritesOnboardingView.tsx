"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FavouritePlayerPicker } from "@/components/shared/favourites/FavouritePlayerPicker";
import { FavouriteTeamPicker } from "@/components/shared/favourites/FavouriteTeamPicker";
import { useMe } from "@/hooks/auth/useMe";
import { useUpdateUser } from "@/hooks/users/useUsers";
import { getSafeRedirectPath } from "@/lib/route.utils";
import { toastifier } from "@/lib/toastifier";
import type { TTeamBrief } from "@/services/PlayerService";
import type { TFavouritePlayer } from "@/services/UserService";

const fieldLabel =
  "mb-2 block font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5]";

export function FavouritesOnboardingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: me } = useMe();
  const updateUser = useUpdateUser(me?.id ?? "");

  const continuePath =
    getSafeRedirectPath(searchParams.get("redirect")) ?? "/dashboard";

  const handleTeamChange = async (team: TTeamBrief) => {
    if (!me?.id) return;
    try {
      await updateUser.mutateAsync({ favourite_team_id: team.id });
    } catch {
      toastifier.error("✕ Unable to save favourite team");
    }
  };

  const handlePlayerChange = async (player: TFavouritePlayer) => {
    if (!me?.id) return;
    try {
      await updateUser.mutateAsync({ favourite_player_id: player.id });
    } catch {
      toastifier.error("✕ Unable to save favourite player");
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
          Follow a team and player to get notified the moment they score.
          You can change this anytime in Profile Settings.
        </p>
      </div>

      <div className="card-fade-in space-y-5 overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5">
        <div>
          <label className={fieldLabel}>Favourite Team</label>
          <FavouriteTeamPicker
            value={me?.favourite_team ?? null}
            onChange={handleTeamChange}
          />
        </div>

        <div>
          <label className={fieldLabel}>Favourite Player</label>
          <FavouritePlayerPicker
            value={me?.favourite_player ?? null}
            onChange={handlePlayerChange}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => router.replace(continuePath)}
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-8 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0] sm:w-auto"
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
