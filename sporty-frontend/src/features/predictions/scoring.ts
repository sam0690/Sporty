/**
 * Single source of truth for how the Predictor rubric (5/3/1/0) reads back to
 * the user. The backend owns the scoring math (app/prediction/services.py); this
 * only maps a resolved points value to its label, short form, and colour tone so
 * the Predict tab and the Predictor page never drift on wording or colour.
 */
export type PredictionTier = {
  /** Full label, e.g. for the resolved detail card. */
  label: string;
  /** Compact form for list rows, e.g. "+5 Exact". */
  short: string;
  /** Text-colour token class for the points/label. */
  tone: string;
  /** Chip background+text classes (tinted, on-brand). */
  chip: string;
};

const EXACT: PredictionTier = {
  label: "Exact score",
  short: "Exact",
  tone: "text-accent",
  chip: "bg-accent/16 text-accent",
};
const GOAL_DIFF: PredictionTier = {
  label: "Result + goal difference",
  short: "Result + GD",
  tone: "text-success",
  chip: "bg-success/14 text-success",
};
const RESULT: PredictionTier = {
  label: "Correct result",
  short: "Result",
  tone: "text-info",
  chip: "bg-info/14 text-info",
};
const MISS: PredictionTier = {
  label: "Missed",
  short: "Missed",
  tone: "text-fg-3",
  chip: "bg-white/[0.06] text-fg-3",
};

/** Tier for a resolved (scored) prediction. */
export function tierForPoints(points: number): PredictionTier {
  if (points >= 5) return EXACT;
  if (points >= 3) return GOAL_DIFF;
  if (points >= 1) return RESULT;
  return MISS;
}

/** The three ways to score, for the pre-match rubric hint. */
export const RUBRIC_HINTS = [
  { pts: "+5", label: "Exact score" },
  { pts: "+3", label: "Result + GD" },
  { pts: "+1", label: "Result" },
] as const;
