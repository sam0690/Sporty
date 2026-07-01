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
      <div className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
        <div className="flex items-center justify-between border-b border-[rgba(11,18,32,0.08)] px-4 py-3">
          <p className="section-label">League Details</p>
          <button
            type="button"
            onClick={onBack}
            className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#DC2626] transition-colors hover:text-[#B91C1C]"
          >
            Edit
          </button>
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(11,18,32,0.08)] px-4 py-3">
            <p className="text-sm text-[#6B7280]">Name</p>
            <p className="text-sm text-[#0B1220]">
              {leagueData.leagueName || "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(11,18,32,0.08)] px-4 py-3">
            <p className="text-sm text-[#6B7280]">Sport</p>
            <p className="text-sm text-[#0B1220]">
              {selectedSports.map((sport) => sportLabels[sport]).join(", ") ||
                "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(11,18,32,0.08)] px-4 py-3">
            <p className="text-sm text-[#6B7280]">Type</p>
            <p className="text-sm text-[#0B1220]">
              {leagueData.isPrivate ? "Private" : "Public"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(11,18,32,0.08)] px-4 py-3">
            <p className="text-sm text-[#6B7280]">Team Size</p>
            <p className="text-sm text-[#0B1220]">{leagueData.teamSize}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-[rgba(11,18,32,0.08)] px-4 py-3">
            <p className="text-sm text-[#6B7280]">Competition Type</p>
            <p className="text-sm text-[#0B1220]">
              {leagueData.competitionType === "draft"
                ? "Draft Mode"
                : "Budget Mode"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            <p className="text-sm text-[#6B7280]">Draft Date</p>
            <p className="text-sm text-[#0B1220]">
              {leagueData.draftDate || "Not set"}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
        <div className="flex items-center justify-between border-b border-[rgba(11,18,32,0.08)] px-4 py-3">
          <p className="section-label">Scoring Rules</p>
          <button
            type="button"
            onClick={onBack}
            className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#DC2626] transition-colors hover:text-[#B91C1C]"
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
                className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]"
              >
                <div className="flex items-center justify-between border-b border-[rgba(11,18,32,0.08)] px-3 py-2">
                  <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]">
                    {sportLabels[sport]}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {isCustomEnabled
                      ? `${customRules.length} custom rule(s)`
                      : "Default scoring"}
                  </p>
                </div>
                <div className="space-y-0">
                  {(isCustomEnabled ? customRules : rules).map((rule) => (
                    <div
                      key={`${sport}-${rule.action}`}
                      className="grid grid-cols-2 border-b border-[rgba(11,18,32,0.08)] px-3 py-2 last:border-b-0"
                    >
                      <p className="text-sm text-[#6B7280]">
                        {formatRuleLabel(rule.action)}
                      </p>
                      <p className="text-sm text-[#0B1220]">
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
          className="w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-8 py-2.5 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280] transition-colors hover:text-[#0B1220] sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isLoading}
          className="w-full rounded-[3px] bg-[#DC2626] px-8 py-2.5 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isLoading ? "Creating…" : "Create League"}
        </button>
      </div>
    </div>
  );
}
