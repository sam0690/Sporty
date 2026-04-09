"use client";

type LeagueSportName = "football" | "basketball";

type EditableScoringRule = {
  action: string;
  description: string;
  defaultPoints: number;
  points: number;
  enabled: boolean;
};

type ScoringSettingsProps = {
  selectedSports: LeagueSportName[];
  scoringRulesBySport: Record<LeagueSportName, EditableScoringRule[]>;
  customScoringEnabledBySport: Record<LeagueSportName, boolean>;
  onToggleSportCustomScoring: (
    sport: LeagueSportName,
    enabled: boolean,
  ) => void;
  onRuleToggle: (
    sport: LeagueSportName,
    action: string,
    enabled: boolean,
  ) => void;
  onRulePointsChange: (
    sport: LeagueSportName,
    action: string,
    points: number,
  ) => void;
  minPoints: number;
  maxPoints: number;
};

const sportTitles: Record<LeagueSportName, string> = {
  football: "⚽ Football Scoring Rules",
  basketball: "🏀 Basketball Scoring Rules",
};

function formatRuleLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ScoringSettings({
  selectedSports,
  scoringRulesBySport,
  customScoringEnabledBySport,
  onToggleSportCustomScoring,
  onRuleToggle,
  onRulePointsChange,
  minPoints,
  maxPoints,
}: ScoringSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900">Scoring Rules</h3>
        <p className="text-xs text-gray-500">
          Enable custom scoring per sport, then toggle and edit individual
          rules.
        </p>
      </div>

      {selectedSports.map((sport, sportIndex) => {
        const allowCustom = customScoringEnabledBySport[sport];
        const rules = scoringRulesBySport[sport] ?? [];

        return (
          <details
            key={sport}
            open={sportIndex === 0}
            className="rounded-xl border border-gray-200 bg-gray-50/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">
                {sportTitles[sport]}
              </span>
              <span className="text-xs text-gray-500">
                {rules.length} rules
              </span>
            </summary>

            <div className="space-y-4 border-t border-gray-200 bg-white px-4 py-4">
              <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
                <span>Enable custom scoring for {sport}</span>
                <button
                  type="button"
                  onClick={() =>
                    onToggleSportCustomScoring(sport, !allowCustom)
                  }
                  className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                    allowCustom ? "bg-primary-600" : "bg-gray-300"
                  }`}
                  aria-pressed={allowCustom}
                  aria-label={`Toggle ${sport} custom scoring`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allowCustom ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              <div className="space-y-3">
                {rules.map((rule) => {
                  const isCustomized =
                    rule.enabled && rule.points !== rule.defaultPoints;
                  const isInvalid =
                    Number.isNaN(rule.points) ||
                    rule.points < minPoints ||
                    rule.points > maxPoints;

                  return (
                    <div
                      key={`${sport}-${rule.action}`}
                      className={`rounded-lg border px-3 py-3 transition-colors ${
                        isCustomized
                          ? "border-amber-300 bg-amber-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {formatRuleLabel(rule.action)}
                            </p>
                            {isCustomized ? (
                              <span className="text-xs text-amber-700">
                                ✏️ Customized
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500">
                            {rule.description}
                          </p>
                          <p className="text-xs text-gray-400">
                            Default: {rule.defaultPoints} pts
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:min-w-55">
                          <label className="flex items-center justify-between text-xs text-gray-600">
                            <span>Custom rule</span>
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              disabled={!allowCustom}
                              onChange={(event) =>
                                onRuleToggle(
                                  sport,
                                  rule.action,
                                  event.target.checked,
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 disabled:cursor-not-allowed"
                            />
                          </label>

                          <input
                            type="number"
                            min={minPoints}
                            max={maxPoints}
                            step={0.1}
                            value={rule.points}
                            disabled={!allowCustom || !rule.enabled}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value);
                              onRulePointsChange(
                                sport,
                                rule.action,
                                Number.isNaN(nextValue)
                                  ? rule.defaultPoints
                                  : nextValue,
                              );
                            }}
                            className={`w-full rounded-lg border px-3 py-2 text-gray-900 outline-none transition focus:border-primary-400 disabled:bg-gray-100 ${
                              isInvalid ? "border-red-300" : "border-gray-200"
                            }`}
                          />
                          {isInvalid && allowCustom && rule.enabled ? (
                            <p className="text-xs text-red-600">
                              Use a value between {minPoints} and {maxPoints}.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        );
      })}

      <p className="text-xs text-gray-500">
        Only changed rules are submitted as league scoring overrides.
      </p>
    </div>
  );
}
