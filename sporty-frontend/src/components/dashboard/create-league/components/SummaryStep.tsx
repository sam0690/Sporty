"use client";

type LeagueSportName = "football" | "basketball";

type EditableScoringRule = {
  action: string;
  description: string;
  defaultPoints: number;
  points: number;
  enabled: boolean;
};

type SummaryStepProps = {
  leagueData: {
    leagueName: string;
    sport: string;
    isPrivate: boolean;
    teamSize: number;
    competitionType: "draft" | "budget";
    draftDate: string;
  };
  selectedSports: LeagueSportName[];
  scoringRulesBySport: Record<LeagueSportName, EditableScoringRule[]>;
  customScoringEnabledBySport: Record<LeagueSportName, boolean>;
  onBack: () => void;
  onCreate: () => void;
  isLoading: boolean;
};

const sportLabels: Record<LeagueSportName, string> = {
  football: "Football",
  basketball: "Basketball",
};

function formatRuleLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function SummaryStep({
  leagueData,
  selectedSports,
  scoringRulesBySport,
  customScoringEnabledBySport,
  onBack,
  onCreate,
  isLoading,
}: SummaryStepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-1">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500">League Details</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-primary-500 hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Name</p>
            <p className="text-sm text-gray-900">
              {leagueData.leagueName || "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Sport</p>
            <p className="text-sm text-gray-900">
              {selectedSports.map((sport) => sportLabels[sport]).join(", ") ||
                "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Type</p>
            <p className="text-sm text-gray-900">
              {leagueData.isPrivate ? "Private" : "Public"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Team Size</p>
            <p className="text-sm text-gray-900">{leagueData.teamSize}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Competition Type</p>
            <p className="text-sm text-gray-900">
              {leagueData.competitionType === "draft"
                ? "Draft Mode"
                : "Budget Mode"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            <p className="text-sm text-gray-500">Draft Date</p>
            <p className="text-sm text-gray-900">
              {leagueData.draftDate || "Not set"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-1">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500">Scoring Rules</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-primary-500 hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          {selectedSports.map((sport) => {
            const rules = scoringRulesBySport[sport] ?? [];
            const isCustomEnabled = customScoringEnabledBySport[sport];
            const customRules = rules.filter(
              (rule) => rule.enabled && rule.points !== rule.defaultPoints,
            );

            return (
              <div key={sport} className="rounded-xl border border-gray-100">
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <p className="text-sm font-medium text-gray-800">
                    {sportLabels[sport]}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isCustomEnabled
                      ? `${customRules.length} custom rule(s)`
                      : "Default scoring"}
                  </p>
                </div>
                <div className="space-y-0">
                  {(isCustomEnabled ? customRules : rules).map((rule) => (
                    <div
                      key={`${sport}-${rule.action}`}
                      className="grid grid-cols-2 border-b border-gray-100 px-3 py-2 last:border-b-0"
                    >
                      <p className="text-sm text-gray-500">
                        {formatRuleLabel(rule.action)}
                      </p>
                      <p className="text-sm text-gray-900">
                        {isCustomEnabled && rule.enabled
                          ? `${rule.points} (default ${rule.defaultPoints})`
                          : rule.defaultPoints}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-full border border-gray-300 bg-white px-8 py-2.5 font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isLoading}
          className="w-full rounded-full bg-[#247BA0] px-8 py-2.5 font-semibold text-white! shadow-sm hover:bg-[#1d6280] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600! disabled:opacity-100 sm:w-auto"
        >
          {isLoading ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}
