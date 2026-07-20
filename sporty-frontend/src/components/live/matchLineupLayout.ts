import {
  buildBasketballLayout,
  buildFootballFormation,
  type FormationPlayerLike,
} from "@/lib/formation/formationEngine";
import type { LineupPlayer } from "@/types/events";

/** Sports that get a graphical lineup surface (all others fall back to a list). */
export type LineupSport = "football" | "basketball";

export type PitchPlayer = FormationPlayerLike & { photoUrl?: string | null };

export type PlacedPlayer = {
  player: PitchPlayer;
  label: string;
  /** 0-1 coordinates on the full two-team pitch. */
  x: number;
  y: number;
};

function toFormationPlayers(players: LineupPlayer[]): PitchPlayer[] {
  return players.map((p) => ({
    id: p.player_id,
    name: p.name ?? "Unknown",
    position: p.position ?? "MID",
    photoUrl: p.photo_url,
  }));
}

/**
 * Lay a starting lineup onto one half of a shared surface. The formation
 * engine places a single team over a full surface (football: GK deep at
 * y≈0.86; basketball: the five on the upper court). Home keeps its own half
 * (bottom): y → 0.5 + y*0.5. Away is rotated 180° into the top half
 * (y → 0.5 - y*0.5, x → 1 - x) so the two teams face each other, FotMob-style.
 */
export function placeMatchTeam(
  lineup: LineupPlayer[],
  side: "home" | "away",
  sport: LineupSport,
): { formationLabel: string; placed: PlacedPlayer[] } {
  const players = toFormationPlayers(lineup);
  const { formationLabel, slots } =
    sport === "basketball"
      ? buildBasketballLayout(players)
      : buildFootballFormation(players);
  const placed = slots
    .filter((s): s is typeof s & { player: PitchPlayer } => s.player != null)
    .map((s) => ({
      player: s.player,
      label: s.label,
      x: side === "home" ? s.x : 1 - s.x,
      y: side === "home" ? 0.5 + s.y * 0.5 : 0.5 - s.y * 0.5,
    }));
  return { formationLabel, placed };
}
