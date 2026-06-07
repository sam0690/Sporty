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
      <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-1 ">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
          <p className="text-sm text-[#555560]">League Details</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-[#e8fb25] hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
            <p className="text-sm text-[#555560]">Name</p>
            <p className="text-sm text-[#f0f0f0]">
              {leagueData.leagueName || "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
            <p className="text-sm text-[#555560]">Sport</p>
            <p className="text-sm text-[#f0f0f0]">
              {selectedSports.map((sport) => sportLabels[sport]).join(", ") ||
                "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
            <p className="text-sm text-[#555560]">Type</p>
            <p className="text-sm text-[#f0f0f0]">
              {leagueData.isPrivate ? "Private" : "Public"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
            <p className="text-sm text-[#555560]">Team Size</p>
            <p className="text-sm text-[#f0f0f0]">{leagueData.teamSize}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
            <p className="text-sm text-[#555560]">Competition Type</p>
            <p className="text-sm text-[#f0f0f0]">
              {leagueData.competitionType === "draft"
                ? "Draft Mode"
                : "Budget Mode"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            <p className="text-sm text-[#555560]">Draft Date</p>
            <p className="text-sm text-[#f0f0f0]">
              {leagueData.draftDate || "Not set"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-1 ">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
          <p className="text-sm text-[#555560]">Scoring Rules</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-[#e8fb25] hover:underline"
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
              <div
                key={sport}
                className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26]"
              >
                <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                  <p className="text-sm text-[#f0f0f0]">
                    {sportLabels[sport]}
                  </p>
                  <p className="text-xs text-[#555560]">
                    {isCustomEnabled
                      ? `${customRules.length} custom rule(s)`
                      : "Default scoring"}
                  </p>
                </div>
                <div className="space-y-0">
                  {(isCustomEnabled ? customRules : rules).map((rule) => (
                    <div
                      key={`${sport}-${rule.action}`}
                      className="grid grid-cols-2 border-b border-[rgba(255,255,255,0.08)] px-3 py-2 last:border-b-0"
                    >
                      <p className="text-sm text-[#555560]">
                        {formatRuleLabel(rule.action)}
                      </p>
                      <p className="text-sm text-[#f0f0f0]">
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
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-8 py-2.5 text-[#f0f0f0] hover:bg-[#1d1d26] hover:text-[#f0f0f0] sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isLoading}
          className="w-full rounded-[3px] bg-linear-to-r [#e8fb25] px-8 py-2.5 font-600 text-background  hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isLoading ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}
