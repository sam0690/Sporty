export type PlayerFilterSport = "All" | "football" | "basketball" | "cricket";

/** Filter values sent straight to the backend — must match the real stored
 * `position` strings, not display abbreviations. */
export const POSITION_MAP: Record<Exclude<PlayerFilterSport, "All">, string[]> = {
  football: ["All", "Forward", "Midfielder", "Defender", "Goalkeeper"],
  basketball: ["All", "Guard", "Forward", "Center"],
  cricket: ["All", "Batter", "Bowler", "All-Rounder", "Wicketkeeper"],
};

export const SPORT_LABELS: Record<PlayerFilterSport, string> = {
  All: "All",
  football: "⚽ Football",
  basketball: "🏀 Basketball",
  cricket: "🏏 Cricket",
};
