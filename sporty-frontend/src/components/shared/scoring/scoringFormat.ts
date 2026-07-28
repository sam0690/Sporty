// Presentation helpers for fantasy-points breakdowns. Deliberately generic:
// unknown actions (future sports, new rules) fall back to a humanized label, so
// the UI never hardcodes a fixed set of scoring categories.

const ACTION_LABELS: Record<string, string> = {
  appearance: "Minutes Played",
  appearance_full: "60+ Minutes",
  goal: "Goal",
  assist: "Assist",
  clean_sheet: "Clean Sheet",
  save: "Saves",
  penalty_save: "Penalty Save",
  penalty_miss: "Penalty Missed",
  own_goal: "Own Goal",
  conceded: "Goals Conceded",
  yellow_card: "Yellow Card",
  red_card: "Red Card",
  defensive_contribution: "Defensive Actions",
  key_pass: "Key Passes",
  shot_on_target: "Shots on Target",
  dribble: "Dribbles",
  bonus: "Bonus",
  // Basketball
  nba_points_10: "Points Scored",
  nba_assists_10: "Assists",
  nba_rebound: "Rebounds",
  nba_steal: "Steals",
  nba_block: "Blocks",
  // Cricket
  cricket_run: "Runs Scored",
  cricket_wicket: "Wickets",
  cricket_catch: "Catches",
  cricket_run_out: "Run Outs",
  cricket_maiden: "Maiden Overs",
};

export function scoreActionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export type PointsTone = "positive" | "negative" | "bonus" | "neutral";

export function pointsTone(subtotal: number, action?: string): PointsTone {
  if (action === "bonus") return "bonus";
  if (subtotal > 0) return "positive";
  if (subtotal < 0) return "negative";
  return "neutral";
}

// Colour coding per spec: positive → green, negative → red, bonus → gold.
export const TONE_TEXT: Record<PointsTone, string> = {
  positive: "text-[#34d399]",
  negative: "text-danger",
  bonus: "text-accent",
  neutral: "text-fg-3",
};

export function formatSignedPoints(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
