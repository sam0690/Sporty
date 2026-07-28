// Presentation layer for scoring rules: maps raw backend `action` keys into
// user-facing categories. The UI renders whatever this produces, so adding a
// sport / renaming a rule / changing points is a data change here, never a
// component change. Unknown or future keys fall into "general" — never crash.

import {
  Target,
  Shield,
  Hand,
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
  Grab,
  type LucideIcon,
} from "lucide-react";

import { scoreActionLabel } from "./scoringFormat";

export type ScoringCategoryId =
  | "attacking"
  | "defensive"
  | "goalkeeping"
  | "discipline"
  | "general"
  | "batting"
  | "bowling"
  | "fielding";

export type ScoringRuleInput = {
  action: string;
  description: string;
  points: number;
};

type CategoryMeta = {
  id: ScoringCategoryId;
  name: string;
  icon: LucideIcon;
  description: string;
  /** CSS custom property from the design system (globals.css) — never a raw hex. */
  colorVar: string;
  order: number;
};

// Generic names so the same category reads correctly across sports
// (basketball points land in "Scoring & Playmaking", steals in "Defense").
const CATEGORY_META: Record<ScoringCategoryId, CategoryMeta> = {
  attacking: {
    id: "attacking",
    name: "Scoring & Playmaking",
    icon: Target,
    description: "Points for creating and finishing chances.",
    colorVar: "--success",
    order: 1,
  },
  defensive: {
    id: "defensive",
    name: "Defense",
    icon: Shield,
    description: "Rewards for stopping the opposition.",
    colorVar: "--info",
    order: 2,
  },
  goalkeeping: {
    id: "goalkeeping",
    name: "Goalkeeping",
    icon: Hand,
    description: "Saves and keeper-specific rewards.",
    colorVar: "--accent",
    order: 3,
  },
  discipline: {
    id: "discipline",
    name: "Discipline",
    icon: AlertTriangle,
    description: "Deductions for cards and mistakes.",
    colorVar: "--danger",
    order: 4,
  },
  general: {
    id: "general",
    name: "Appearances & Bonus",
    icon: Clock,
    description: "Playing time and standout-performance bonuses.",
    colorVar: "--fg-2",
    order: 5,
  },
  batting: {
    id: "batting",
    name: "Batting",
    icon: TrendingUp,
    description: "Runs and batting milestones.",
    colorVar: "--success",
    order: 1,
  },
  bowling: {
    id: "bowling",
    name: "Bowling",
    icon: Zap,
    description: "Wickets and economical spells.",
    colorVar: "--info",
    order: 2,
  },
  fielding: {
    id: "fielding",
    name: "Fielding",
    icon: Grab,
    description: "Catches and run-outs in the field.",
    colorVar: "--accent",
    order: 3,
  },
};

// action → category. Actions are already sport-scoped (nba_/cricket_ prefixes,
// football keys are unique), so a flat map is enough. Add a sport = add rows.
const ACTION_CATEGORY: Record<string, ScoringCategoryId> = {
  // Football
  appearance: "general",
  appearance_full: "general",
  bonus: "general",
  goal: "attacking",
  assist: "attacking",
  key_pass: "attacking",
  shot_on_target: "attacking",
  dribble: "attacking",
  penalty_miss: "attacking",
  clean_sheet: "defensive",
  conceded: "defensive",
  defensive_contribution: "defensive",
  save: "goalkeeping",
  penalty_save: "goalkeeping",
  yellow_card: "discipline",
  red_card: "discipline",
  own_goal: "discipline",
  // Basketball
  nba_points_10: "attacking",
  nba_assists_10: "attacking",
  nba_rebound: "defensive",
  nba_steal: "defensive",
  nba_block: "defensive",
  // Cricket
  cricket_run: "batting",
  cricket_wicket: "bowling",
  cricket_maiden: "bowling",
  cricket_catch: "fielding",
  cricket_run_out: "fielding",
};

export type ScoringRuleView = {
  action: string;
  label: string;
  /** Point range: min === max unless the rule varies by position. */
  minPoints: number;
  maxPoints: number;
  /** How many underlying backend rules collapsed into this row (per-position). */
  ruleCount: number;
};

export type ScoringCategoryView = CategoryMeta & {
  rules: ScoringRuleView[];
  /** Distinct actions in this category — the "N scoring rules" the user sees. */
  count: number;
};

const shortLabels = (rules: ScoringRuleView[]): string[] =>
  rules.slice(0, 3).map((r) => r.label);

/** Representative example labels for a category's collapsed card. */
export function categoryExamples(category: ScoringCategoryView): string[] {
  return shortLabels(category.rules);
}

// Group raw rules into ordered, non-empty categories, collapsing per-position
// duplicates (e.g. football `goal` GKP/DEF/MID/FWD → one row, +4 to +6).
export function groupRulesIntoCategories(
  rules: ScoringRuleInput[],
): ScoringCategoryView[] {
  const byCategory = new Map<ScoringCategoryId, Map<string, ScoringRuleView>>();

  for (const rule of rules) {
    const categoryId = ACTION_CATEGORY[rule.action] ?? "general";
    if (!byCategory.has(categoryId)) byCategory.set(categoryId, new Map());
    const actions = byCategory.get(categoryId)!;

    const existing = actions.get(rule.action);
    if (existing) {
      existing.minPoints = Math.min(existing.minPoints, rule.points);
      existing.maxPoints = Math.max(existing.maxPoints, rule.points);
      existing.ruleCount += 1;
    } else {
      actions.set(rule.action, {
        action: rule.action,
        label: scoreActionLabel(rule.action),
        minPoints: rule.points,
        maxPoints: rule.points,
        ruleCount: 1,
      });
    }
  }

  return [...byCategory.entries()]
    .map(([id, actions]) => {
      const ruleViews = [...actions.values()];
      return {
        ...CATEGORY_META[id],
        rules: ruleViews,
        count: ruleViews.length,
      };
    })
    .filter((c) => c.rules.length > 0)
    .sort((a, b) => a.order - b.order);
}

const PHILOSOPHY: Record<string, string> = {
  football:
    "Goals, assists and clean sheets drive the score; cards and mistakes cost you.",
  basketball:
    "Every stat line counts — scoring, playmaking and defense all earn points.",
  cricket: "Runs, wickets and sharp fielding all contribute to your total.",
};

export function scoringPhilosophy(sport: string): string {
  return (
    PHILOSOPHY[sport] ??
    "Points are earned from real match performance across several categories."
  );
}
