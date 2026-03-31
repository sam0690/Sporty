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
          <h3 className="text-sm font-medium text-gray-900">Scoring Rules</h3>
          <p className="text-xs text-gray-500">
            Default rules are loaded for {sport || "your"} league.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm text-gray-600">
          <span>Use custom scoring</span>
          <button
            type="button"
            onClick={() => setAllowCustom((prev) => !prev)}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              allowCustom ? "bg-primary-600" : "bg-gray-300"
            }`}
            aria-pressed={allowCustom}
            aria-label="Toggle custom scoring"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                allowCustom ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {entries.map(([label, value]) => (
          <div key={label} className="space-y-2">
            <label className="block text-sm text-gray-600">{label}</label>
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 outline-none transition focus:border-primary-400 disabled:bg-gray-100"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
