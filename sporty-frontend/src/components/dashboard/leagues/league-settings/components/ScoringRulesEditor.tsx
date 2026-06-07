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
    <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
      <h3 className="text-sm text-[#f0f0f0]">Scoring Rules</h3>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(scoringRules).map(([rule, value]) => (
          <div key={rule}>
            <label className="mb-1 block text-sm text-[#555560]">
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
              className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
