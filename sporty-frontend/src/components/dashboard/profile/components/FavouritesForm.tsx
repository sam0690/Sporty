"use client";

import { BasketballGlyph, FootballGlyph } from "@/components/landing/sport-icons";
import { FavouritePlayerPicker } from "@/components/shared/favourites/FavouritePlayerPicker";
import { FavouriteTeamPicker } from "@/components/shared/favourites/FavouriteTeamPicker";
import type { TFavouritePlayer, TFavouriteTeam } from "@/services/UserService";
import type { TTeamBrief } from "@/services/PlayerService";

type SportName = "football" | "basketball";

type FavouritesFormProps = {
  favouriteTeams: TFavouriteTeam[];
  favouritePlayers: TFavouritePlayer[];
  onTeamChange: (sport: SportName, team: TTeamBrief) => void;
  onTeamClear: (sport: SportName) => void;
  onPlayerChange: (sport: SportName, player: TFavouritePlayer) => void;
  onPlayerClear: (sport: SportName) => void;
};

const fieldLabel =
  "mb-2 block font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5]";

const SPORTS: Array<{ sport: SportName; Icon: typeof FootballGlyph; color: string; label: string }> = [
  { sport: "football", Icon: FootballGlyph, color: "#00ff88", label: "Football" },
  { sport: "basketball", Icon: BasketballGlyph, color: "#ff6b00", label: "Basketball" },
];

export function FavouritesForm({
  favouriteTeams,
  favouritePlayers,
  onTeamChange,
  onTeamClear,
  onPlayerChange,
  onPlayerClear,
}: FavouritesFormProps) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#121218]">
      <header className="border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
        <p className="section-label">Favourites</p>
      </header>

      <div className="space-y-6 p-5">
        <p className="text-sm text-[#9a9aa5]">
          Pick a favourite team and player per sport to get notified when they score.
        </p>

        {SPORTS.map(({ sport, Icon, color, label }) => {
          const team = favouriteTeams.find((t) => t.sport.name === sport) ?? null;
          const player = favouritePlayers.find((p) => p.sport.name === sport) ?? null;

          return (
            <div key={sport} className="space-y-4 border-t border-[rgba(255,255,255,0.06)] pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2" style={{ color }}>
                <Icon className="size-4 shrink-0" />
                <p className="font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px]">
                  {label}
                </p>
              </div>

              <div>
                <label className={fieldLabel}>Favourite Team</label>
                <FavouriteTeamPicker
                  sport={sport}
                  value={team}
                  onChange={(t) => onTeamChange(sport, t)}
                  onClear={team ? () => onTeamClear(sport) : undefined}
                />
              </div>

              <div>
                <label className={fieldLabel}>Favourite Player</label>
                <FavouritePlayerPicker
                  sport={sport}
                  value={player}
                  onChange={(p) => onPlayerChange(sport, p)}
                  onClear={player ? () => onPlayerClear(sport) : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
