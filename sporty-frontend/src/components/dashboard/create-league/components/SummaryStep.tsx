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
      <div className="rounded-lg border border-accent/20 bg-white p-1">
        <div className="flex items-center justify-between border-b border-accent/20 px-4 py-3">
          <p className="text-sm text-secondary">League Details</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-primary-500 hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-2 gap-2 border-b border-accent/20 px-4 py-3">
            <p className="text-sm text-secondary">Name</p>
            <p className="text-sm text-black">
              {leagueData.leagueName || "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-accent/20 px-4 py-3">
            <p className="text-sm text-secondary">Sport</p>
            <p className="text-sm text-black">
              {selectedSports.map((sport) => sportLabels[sport]).join(", ") ||
                "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-accent/20 px-4 py-3">
            <p className="text-sm text-secondary">Type</p>
            <p className="text-sm text-black">
              {leagueData.isPrivate ? "Private" : "Public"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-accent/20 px-4 py-3">
            <p className="text-sm text-secondary">Team Size</p>
            <p className="text-sm text-black">{leagueData.teamSize}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-accent/20 px-4 py-3">
            <p className="text-sm text-secondary">Competition Type</p>
            <p className="text-sm text-black">
              {leagueData.competitionType === "draft"
                ? "Draft Mode"
                : "Budget Mode"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            <p className="text-sm text-secondary">Draft Date</p>
            <p className="text-sm text-black">
              {leagueData.draftDate || "Not set"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-accent/20 bg-white p-1">
        <div className="flex items-center justify-between border-b border-accent/20 px-4 py-3">
          <p className="text-sm text-secondary">Scoring Rules</p>
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
              <div key={sport} className="rounded-md border border-accent/20">
                <div className="flex items-center justify-between border-b border-accent/20 px-3 py-2">
                  <p className="text-sm font-medium text-black">
                    {sportLabels[sport]}
                  </p>
                  <p className="text-xs text-secondary">
                    {isCustomEnabled
                      ? `${customRules.length} custom rule(s)`
                      : "Default scoring"}
                  </p>
                </div>
                <div className="space-y-0">
                  {(isCustomEnabled ? customRules : rules).map((rule) => (
                    <div
                      key={`${sport}-${rule.action}`}
                      className="grid grid-cols-2 border-b border-accent/20 px-3 py-2 last:border-b-0"
                    >
                      <p className="text-sm text-secondary">
                        {formatRuleLabel(rule.action)}
                      </p>
                      <p className="text-sm text-black">
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
          className="w-full rounded-full border border-border bg-white px-8 py-2.5 font-medium text-black hover:bg-[#F4F4F9] sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isLoading}
          className="w-full rounded-full bg-[#247BA0] px-8 py-2.5 font-semibold text-white! shadow-sm hover:bg-[#1d6280] disabled:cursor-not-allowed disabled:bg-accent/40 disabled:text-secondary! disabled:opacity-100 sm:w-auto"
        >
          {isLoading ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}
