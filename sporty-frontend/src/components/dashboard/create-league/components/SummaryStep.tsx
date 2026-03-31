"use client";

type SummaryStepProps = {
  leagueData: {
    leagueName: string;
    sport: string;
    isPrivate: boolean;
    teamSize: number;
    draftType: string;
    draftDate: string;
    scoringRules: Record<string, number>;
  };
  onBack: () => void;
  onCreate: () => void;
  isLoading: boolean;
};

export function SummaryStep({ leagueData, onBack, onCreate, isLoading }: SummaryStepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-text-primary">League Details</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-text-secondary sm:grid-cols-2">
          <p>
            <span className="font-medium text-text-primary">Name:</span> {leagueData.leagueName || "-"}
          </p>
          <p>
            <span className="font-medium text-text-primary">Sport:</span> {leagueData.sport || "-"}
          </p>
          <p>
            <span className="font-medium text-text-primary">Type:</span> {leagueData.isPrivate ? "Private" : "Public"}
          </p>
          <p>
            <span className="font-medium text-text-primary">Team Size:</span> {leagueData.teamSize}
          </p>
          <p>
            <span className="font-medium text-text-primary">Draft Type:</span> {leagueData.draftType}
          </p>
          <p>
            <span className="font-medium text-text-primary">Draft Date:</span> {leagueData.draftDate || "Not set"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-text-primary">Scoring Rules</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-text-secondary sm:grid-cols-2">
          {Object.entries(leagueData.scoringRules).map(([label, value]) => (
            <p key={label}>
              <span className="font-medium text-text-primary">{label}:</span> {value}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-3 font-semibold text-text-primary hover:bg-surface-200"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={isLoading}
          className="rounded-lg bg-primary-500 px-6 py-3 font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}
