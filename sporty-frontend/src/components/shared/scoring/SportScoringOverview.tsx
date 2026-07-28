"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { formatSignedPoints } from "./scoringFormat";
import {
  groupRulesIntoCategories,
  scoringPhilosophy,
  categoryExamples,
  type ScoringRuleInput,
  type ScoringRuleView,
  type ScoringCategoryView,
} from "./scoringCategories";

type SportScoringOverviewProps = {
  sport: string;
  sportLabel: string;
  rules: ScoringRuleInput[];
};

function pointsBadge(rule: ScoringRuleView): { text: string; negative: boolean } {
  const negative = rule.maxPoints < 0;
  const text =
    rule.minPoints === rule.maxPoints
      ? formatSignedPoints(rule.maxPoints)
      : `${formatSignedPoints(rule.minPoints)} to ${formatSignedPoints(rule.maxPoints)}`;
  return { text, negative };
}

function ExpandableCategory({
  category,
  sport,
}: {
  category: ScoringCategoryView;
  sport: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = category.icon;
  const panelId = `scoring-${sport}-${category.id}`;
  const accent = `var(${category.colorVar})`;
  const examples = categoryExamples(category);

  return (
    <div className="overflow-hidden rounded-[3px] border border-white/8 bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-3"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[3px]"
          style={{
            color: accent,
            backgroundColor: `color-mix(in oklab, ${accent} 14%, transparent)`,
          }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-sans text-sm font-700 text-fg-1">
              {category.name}
            </span>
            <span className="text-xs text-fg-3">
              {category.count} {category.count === 1 ? "rule" : "rules"}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-fg-3">
            {open ? category.description : examples.join(" · ")}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-fg-3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul id={panelId} className="space-y-0 border-t border-white/8">
          {category.rules.map((rule) => {
            const badge = pointsBadge(rule);
            return (
              <li
                key={rule.action}
                className="flex items-center gap-2 border-b border-white/8 px-3 py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-fg-2">
                  {rule.label}
                </span>
                <span
                  className={`shrink-0 font-700 tabular-nums ${badge.negative ? "text-danger" : "text-[#34d399]"}`}
                >
                  {badge.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Progressive-disclosure scoring overview: philosophy line + collapsed category
// cards that expand to friendly rule rows. Reusable across league creation,
// details, settings and public pages — pass the sport's default rules.
export function SportScoringOverview({
  sport,
  sportLabel,
  rules,
}: SportScoringOverviewProps) {
  const categories = groupRulesIntoCategories(rules);

  if (categories.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-fg-3">
        Default scoring will be applied once the season starts.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-fg-2">{scoringPhilosophy(sport)}</p>
        <span className="shrink-0 whitespace-nowrap text-xs text-fg-3">
          {sportLabel} · Default
        </span>
      </div>
      <div className="space-y-2">
        {categories.map((category) => (
          <ExpandableCategory
            key={category.id}
            category={category}
            sport={sport}
          />
        ))}
      </div>
    </div>
  );
}
