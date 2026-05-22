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
      <div className="rounded-3xl border border-white/10 bg-surface/75 p-1 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm text-slate-400">League Details</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-accent-primary hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-4 py-3">
            <p className="text-sm text-slate-400">Name</p>
            <p className="text-sm text-foreground">
              {leagueData.leagueName || "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-4 py-3">
            <p className="text-sm text-slate-400">Sport</p>
            <p className="text-sm text-foreground">
              {selectedSports.map((sport) => sportLabels[sport]).join(", ") ||
                "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-4 py-3">
            <p className="text-sm text-slate-400">Type</p>
            <p className="text-sm text-foreground">
              {leagueData.isPrivate ? "Private" : "Public"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-4 py-3">
            <p className="text-sm text-slate-400">Team Size</p>
            <p className="text-sm text-foreground">{leagueData.teamSize}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-4 py-3">
            <p className="text-sm text-slate-400">Competition Type</p>
            <p className="text-sm text-foreground">
              {leagueData.competitionType === "draft"
                ? "Draft Mode"
                : "Budget Mode"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            <p className="text-sm text-slate-400">Draft Date</p>
            <p className="text-sm text-foreground">
              {leagueData.draftDate || "Not set"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-surface/75 p-1 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm text-slate-400">Scoring Rules</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-accent-primary hover:underline"
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
                className="rounded-2xl border border-white/10 bg-white/5"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <p className="text-sm font-medium text-foreground">
                    {sportLabels[sport]}
                  </p>
                  <p className="text-xs text-slate-400">
                    {isCustomEnabled
                      ? `${customRules.length} custom rule(s)`
                      : "Default scoring"}
                  </p>
                </div>
                <div className="space-y-0">
                  {(isCustomEnabled ? customRules : rules).map((rule) => (
                    <div
                      key={`${sport}-${rule.action}`}
                      className="grid grid-cols-2 border-b border-white/10 px-3 py-2 last:border-b-0"
                    >
                      <p className="text-sm text-slate-400">
                        {formatRuleLabel(rule.action)}
                      </p>
                      <p className="text-sm text-foreground">
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
          className="w-full rounded-full border border-white/10 bg-white/5 px-8 py-2.5 font-medium text-slate-300 hover:bg-white/8 hover:text-foreground sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isLoading}
          className="w-full rounded-full bg-linear-to-r from-accent-primary via-cyan-400 to-accent-secondary px-8 py-2.5 font-semibold text-background shadow-[0_16px_40px_rgba(0,229,255,0.18)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isLoading ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}
