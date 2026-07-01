"use client";

import {
  SettingsSection,
  settingsInput,
} from "@/components/dashboard/leagues/league-settings/components/SettingsSection";

type ScoringRulesEditorProps = {
  scoringRules: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
};

function humanize(action: string): string {
  return action
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ScoringRulesEditor({
  scoringRules,
  onChange,
}: ScoringRulesEditorProps) {
  const rules = Object.entries(scoringRules);

  return (
    <SettingsSection
      title="Scoring Rules"
      description="Points awarded per action — overrides the sport defaults"
    >
      {rules.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No scoring rules for this sport.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rules.map(([rule, value]) => (
            <div
              key={rule}
              className="flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-3 py-2"
            >
              <span className="min-w-0 truncate font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
                {humanize(rule)}
              </span>
              <input
                type="number"
                step={0.1}
                value={value}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  onChange({
                    ...scoringRules,
                    [rule]: Number.isNaN(next) ? 0 : next,
                  });
                }}
                className={`${settingsInput} w-20 shrink-0 px-3 py-1.5 text-right font-bebas text-lg tracking-[1px] text-[#DC2626]`}
              />
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
