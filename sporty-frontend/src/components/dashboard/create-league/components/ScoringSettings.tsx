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
  football: "Football Scoring",
  basketball: "Basketball Scoring",
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
    <div className="space-y-5">
      <div>
        <p className="section-label">Scoring Rules</p>
        <p className="mt-1 text-xs text-[#6B7280]">
          Enable custom scoring per sport, then toggle and edit individual
          rules. Only changed rules are saved.
        </p>
      </div>

      {selectedSports.map((sport, sportIndex) => {
        const allowCustom = customScoringEnabledBySport[sport];
        const rules = scoringRulesBySport[sport] ?? [];

        return (
          <details
            key={sport}
            open={sportIndex === 0}
            className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#0B1220]">
                {sportTitles[sport]}
              </span>
              <span className="font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#6B7280]">
                {rules.length} rules
              </span>
            </summary>

            <div className="space-y-4 border-t border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-4">
              <label className="flex items-center justify-between gap-3">
                <span className="font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
                  Enable custom scoring
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onToggleSportCustomScoring(sport, !allowCustom)
                  }
                  className={`relative h-6 w-11 rounded-full border transition-colors ${
                    allowCustom
                      ? "border-[rgba(220,38,38,0.4)] bg-[#DC2626]"
                      : "border-[rgba(11,18,32,0.1)] bg-[#F3F4F7]"
                  }`}
                  aria-pressed={allowCustom}
                  aria-label={`Toggle ${sport} custom scoring`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full shadow-sm transition-transform ${
                      allowCustom
                        ? "translate-x-5 bg-[#F6F7F9]"
                        : "translate-x-0.5 bg-[#6B7280]"
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
                      className={`rounded-[3px] border px-3 py-3 transition-colors ${
                        isCustomized
                          ? "border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.06)]"
                          : "border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
                              {formatRuleLabel(rule.action)}
                            </p>
                            {isCustomized ? (
                              <span className="rounded-[3px] bg-[rgba(220,38,38,0.15)] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] text-[#DC2626]">
                                Custom
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-[#6B7280]">
                            {rule.description}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            Default: {rule.defaultPoints} pts
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:min-w-55">
                          <label className="flex items-center justify-between font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] text-[#6B7280]">
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
                              className="size-4 accent-[#DC2626] disabled:cursor-not-allowed"
                            />
                          </label>

                          <input
                            type="number"
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
                            className={`w-full rounded-[3px] border bg-[#FFFFFF] px-3 py-2 text-right font-bebas text-lg tracking-[1px] text-[#DC2626] outline-none transition-colors focus:border-[#DC2626] disabled:opacity-50 ${
                              isInvalid
                                ? "border-[rgba(255,59,48,0.4)]"
                                : "border-[rgba(11,18,32,0.08)]"
                            }`}
                          />
                          {isInvalid && allowCustom && rule.enabled ? (
                            <p className="text-xs text-[#DC2626]">
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
    </div>
  );
}
