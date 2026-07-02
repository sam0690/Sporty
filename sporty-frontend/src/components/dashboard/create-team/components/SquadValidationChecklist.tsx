"use client";

export type SquadValidationRule = {
  key: string;
  label: string;
  detail: string;
  satisfied: boolean;
};

type SquadValidationChecklistProps = {
  rules: SquadValidationRule[];
  title?: string;
};

/**
 * Live squad-composition checklist. Shows the enforced squad rules (size,
 * budget, and — for multisport leagues — per-sport minimums) with a ✓/✗ per
 * rule so users see exactly what's required while building in budget OR draft
 * mode.
 */
export function SquadValidationChecklist({
  rules,
  title = "Requirements",
}: SquadValidationChecklistProps) {
  if (rules.length === 0) return null;

  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
      <span className="section-label">{title}</span>
      <ul className="mt-3 space-y-2">
        {rules.map((rule) => (
          <li key={rule.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-700 ${
                  rule.satisfied
                    ? "bg-[rgba(76,175,80,0.15)] text-[#4caf50]"
                    : "bg-[rgba(255,255,255,0.06)] text-[#555560]"
                }`}
              >
                {rule.satisfied ? "✓" : ""}
              </span>
              <span
                className={`font-barlow-condensed text-xs font-700 uppercase tracking-[1px] ${
                  rule.satisfied ? "text-[#f0f0f0]" : "text-[#9a9aa5]"
                }`}
              >
                {rule.label}
              </span>
            </span>
            <span
              className={`font-bebas text-sm tracking-[1px] tabular-nums ${
                rule.satisfied ? "text-[#e8fb25]" : "text-[#9a9aa5]"
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
