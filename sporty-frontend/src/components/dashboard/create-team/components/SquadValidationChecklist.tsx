"use client";

import { Check } from "lucide-react";

export type SquadValidationRule = {
  key: string;
  label: string;
  detail: string;
  satisfied: boolean;
};

export type ClubCountWarning = {
  club: string;
  count: number;
  max: number;
};

type SquadValidationChecklistProps = {
  rules: SquadValidationRule[];
  title?: string;
  clubWarnings?: ClubCountWarning[];
};

/**
 * Live squad-composition checklist. Shows the enforced squad rules (size,
 * budget, position minimums, and — for multisport leagues — per-sport
 * minimums) with a ✓/✗ per rule so users see exactly what's required while
 * building in budget OR draft mode. clubWarnings surfaces any real-world club
 * that's at or over the max-per-club cap, since that's a per-club tally
 * rather than a single pass/fail rule.
 */
export function SquadValidationChecklist({
  rules,
  title = "Requirements",
  clubWarnings = [],
}: SquadValidationChecklistProps) {
  if (rules.length === 0 && clubWarnings.length === 0) return null;

  return (
    <section className="card-surface p-4">
      <span className="section-label">{title}</span>
      {clubWarnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {clubWarnings.map((warning) => (
            <li
              key={warning.club}
              className="flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] px-2.5 py-1.5"
            >
              <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-danger">
                {warning.club} at club limit
              </span>
              <span className="font-bebas text-sm tracking-[1px] tabular-nums text-danger">
                {warning.count}/{warning.max}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 space-y-2">
        {rules.map((rule) => (
          <li key={rule.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-700 ${
                  rule.satisfied
                    ? "bg-success/15 text-success"
                    : "bg-white/6 text-fg-3"
                }`}
              >
                {rule.satisfied ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
              </span>
              <span
                className={`font-barlow-condensed text-xs font-700 uppercase tracking-[1px] ${
                  rule.satisfied ? "text-fg-1" : "text-fg-2"
                }`}
              >
                {rule.label}
              </span>
            </span>
            <span
              className={`font-bebas text-sm tracking-[1px] tabular-nums ${
                rule.satisfied ? "text-accent" : "text-fg-2"
              }`}
            >
              {rule.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
