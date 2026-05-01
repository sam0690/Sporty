"use client";

type ScoringRulesEditorProps = {
  scoringRules: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
};

export function ScoringRulesEditor({ scoringRules, onChange }: ScoringRulesEditorProps) {
  return (
    <section className="space-y-4 rounded-lg border border-accent/20 bg-white p-5">
      <h3 className="text-sm font-medium text-black">Scoring Rules</h3>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(scoringRules).map(([rule, value]) => (
          <div key={rule}>
            <label className="mb-1 block text-sm text-secondary">{rule}</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={value}
              onChange={(event) => {
                const next = Number(event.target.value);
                onChange({
                  ...scoringRules,
                  [rule]: Number.isNaN(next) ? 0 : next,
                });
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-black outline-none focus:border-primary-400"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
