export type PlayerFilterSport = "All" | "football" | "basketball" | "cricket";

/** Filter values sent straight to the backend — must match the real stored
 * `Player.position` codes (see Sporty_Backend/seed_data.py POSITIONS). */
export const POSITION_MAP: Record<Exclude<PlayerFilterSport, "All">, string[]> = {
  football: ["All", "GKP", "DEF", "MID", "FWD"],
  basketball: ["All", "PG", "SG", "SF", "PF", "C"],
  cricket: ["All", "BAT", "BOWL", "AR", "WK"],
};

/** Display labels for the position codes above — UI shows the full name,
 * queries still use the short code. */
export const POSITION_LABELS: Record<string, string> = {
  All: "All Positions",
  GKP: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
  PG: "Point Guard",
  SG: "Shooting Guard",
  SF: "Small Forward",
  PF: "Power Forward",
  C: "Center",
  BAT: "Batter",
  BOWL: "Bowler",
  AR: "All-Rounder",
  WK: "Wicketkeeper",
};

export const SPORT_LABELS: Record<PlayerFilterSport, string> = {
  All: "All",
  football: "⚽ Football",
  basketball: "🏀 Basketball",
  cricket: "🏏 Cricket",
};
