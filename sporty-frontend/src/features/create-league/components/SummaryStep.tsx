"use client";

type LeagueSportName = "football" | "basketball";

type ScoringRuleDisplay = {
  action: string;
  description: string;
  points: number;
};

type SummaryStepProps = {
  leagueData: {
    leagueName: string;
    sport: string;
    isPrivate: boolean;
    teamSize: number;
    competitionType: "draft" | "budget";
    isHeadToHead: boolean;
    draftDate: string;
  };
  selectedSports: LeagueSportName[];
  scoringRulesBySport: Record<LeagueSportName, ScoringRuleDisplay[]>;
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
  onBack,
  onCreate,
  isLoading,
}: SummaryStepProps) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden card-surface">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <p className="section-label">League Details</p>
          <button
            type="button"
            onClick={onBack}
            className="font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-accent transition-colors hover:text-accent-bright"
          >
            Edit
          </button>
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-2 gap-2 border-b border-white/8 px-4 py-3">
            <p className="text-sm text-fg-3">Name</p>
            <p className="text-sm text-fg-1">
              {leagueData.leagueName || "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/8 px-4 py-3">
            <p className="text-sm text-fg-3">Sport</p>
            <p className="text-sm text-fg-1">
              {selectedSports.map((sport) => sportLabels[sport]).join(", ") ||
                "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/8 px-4 py-3">
            <p className="text-sm text-fg-3">Type</p>
            <p className="text-sm text-fg-1">
              {leagueData.isPrivate ? "Private" : "Public"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/8 px-4 py-3">
            <p className="text-sm text-fg-3">Team Size</p>
            <p className="text-sm text-fg-1">{leagueData.teamSize}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/8 px-4 py-3">
            <p className="text-sm text-fg-3">Competition Type</p>
            <p className="text-sm text-fg-1">
              {leagueData.competitionType === "draft"
                ? "Draft Mode"
                : "Budget Mode"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/8 px-4 py-3">
            <p className="text-sm text-fg-3">Standings</p>
            <p className="text-sm text-fg-1">
              {leagueData.isHeadToHead ? "Head-to-Head" : "Points Total"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            <p className="text-sm text-fg-3">Draft Date</p>
            <p className="text-sm text-fg-1">
              {leagueData.draftDate || "Not set"}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden card-surface">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <p className="section-label">Scoring Rules</p>
        </div>
        <div className="space-y-3 px-4 py-3">
          {selectedSports.map((sport) => {
            const rules = scoringRulesBySport[sport] ?? [];

            return (
              <div
                key={sport}
                className="overflow-hidden rounded-[3px] border border-white/8 bg-surface-2"
              >
                <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                  <p className="font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                    {sportLabels[sport]}
                  </p>
                  <p className="text-xs text-fg-3">Default scoring</p>
                </div>
                <div className="space-y-0">
                  {rules.map((rule) => (
                    <div
                      key={`${sport}-${rule.action}`}
                      className="grid grid-cols-2 border-b border-white/8 px-3 py-2 last:border-b-0"
                    >
                      <p className="text-sm text-fg-3">
                        {formatRuleLabel(rule.action)}
                      </p>
                      <p className="text-sm text-fg-1">{rule.points}</p>
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
          className="w-full rounded-[3px] border border-white/8 bg-surface-3 px-8 py-2.5 font-sans text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1 sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isLoading}
          className="w-full rounded-[3px] bg-accent px-8 py-2.5 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isLoading ? "Creating…" : "Create League"}
        </button>
      </div>
    </div>
  );
}
