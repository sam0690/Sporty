"use client";

type ScoringRulesEditorProps = {
  scoringRules: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
};

export function ScoringRulesEditor({
  scoringRules,
  onChange,
}: ScoringRulesEditorProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <h3 className="text-sm font-medium text-foreground">Scoring Rules</h3>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(scoringRules).map(([rule, value]) => (
          <div key={rule}>
            <label className="mb-1 block text-sm text-foreground/60">
              {rule}
            </label>
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
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
