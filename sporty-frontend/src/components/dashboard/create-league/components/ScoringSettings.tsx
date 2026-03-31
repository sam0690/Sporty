"use client";

import { useState } from "react";

type ScoringSettingsProps = {
  scoringRules: Record<string, number>;
  onScoringChange: (next: Record<string, number>) => void;
  sport: string;
};

export function ScoringSettings({ scoringRules, onScoringChange, sport }: ScoringSettingsProps) {
  const [allowCustom, setAllowCustom] = useState(false);

  const entries = Object.entries(scoringRules);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Scoring Rules</h3>
          <p className="text-xs text-text-secondary">
            Default rules are loaded for {sport || "your"} league.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={allowCustom}
            onChange={(event) => setAllowCustom(event.target.checked)}
            className="h-4 w-4 rounded border-border text-primary-500 focus:ring-primary-500"
          />
          Allow custom values
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {entries.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border p-4">
            <label className="mb-2 block text-sm font-medium text-text-primary">{label}</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={value}
              disabled={!allowCustom}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                onScoringChange({
                  ...scoringRules,
                  [label]: Number.isNaN(nextValue) ? 0 : nextValue,
                });
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-surface-200"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
