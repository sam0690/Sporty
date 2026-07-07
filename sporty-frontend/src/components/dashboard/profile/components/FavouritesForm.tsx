"use client";

import { FavouritePlayerPicker } from "@/components/shared/favourites/FavouritePlayerPicker";
import { FavouriteTeamPicker } from "@/components/shared/favourites/FavouriteTeamPicker";
import type { TFavouritePlayer, TFavouriteTeam } from "@/services/UserService";
import type { TTeamBrief } from "@/services/PlayerService";

type FavouritesFormProps = {
  favouriteTeam: TFavouriteTeam | null;
  favouritePlayer: TFavouritePlayer | null;
  onTeamChange: (team: TTeamBrief) => void;
  onPlayerChange: (player: TFavouritePlayer) => void;
};

const fieldLabel =
  "mb-2 block font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5]";

export function FavouritesForm({
  favouriteTeam,
  favouritePlayer,
  onTeamChange,
  onPlayerChange,
}: FavouritesFormProps) {
  return (
    <div className="card-fade-in overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <header className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <p className="section-label">Favourites</p>
      </header>

      <div className="space-y-5 p-5">
        <p className="text-sm text-[#9a9aa5]">
          Pick a favourite team and player to get notified when they score.
        </p>

        <div>
          <label className={fieldLabel}>Favourite Team</label>
          <FavouriteTeamPicker value={favouriteTeam} onChange={onTeamChange} />
        </div>

        <div>
          <label className={fieldLabel}>Favourite Player</label>
          <FavouritePlayerPicker value={favouritePlayer} onChange={onPlayerChange} />
        </div>
      </div>
    </div>
  );
}
