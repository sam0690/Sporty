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
      <div className="rounded-2xl border border-gray-100 bg-white p-1">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500">League Details</p>
          <button type="button" onClick={onBack} className="text-xs text-primary-500 hover:underline">Edit</button>
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Name</p>
            <p className="text-sm text-gray-900">{leagueData.leagueName || "-"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Sport</p>
            <p className="text-sm text-gray-900">{leagueData.sport || "-"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Type</p>
            <p className="text-sm text-gray-900">{leagueData.isPrivate ? "Private" : "Public"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Team Size</p>
            <p className="text-sm text-gray-900">{leagueData.teamSize}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Draft Type</p>
            <p className="text-sm text-gray-900">{leagueData.draftType}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            <p className="text-sm text-gray-500">Draft Date</p>
            <p className="text-sm text-gray-900">{leagueData.draftDate || "Not set"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-1">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500">Scoring Rules</p>
          <button type="button" onClick={onBack} className="text-xs text-primary-500 hover:underline">Edit</button>
        </div>
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
          {Object.entries(leagueData.scoringRules).map(([label, value]) => (
            <div key={label} className="grid grid-cols-2 border-b border-gray-100 px-4 py-3 last:border-b-0">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-sm text-gray-900">{value}</p>
            </div>
          ))}
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
          className="w-full rounded-full bg-[#247BA0] px-8 py-2.5 font-semibold !text-white shadow-sm hover:bg-[#1d6280] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:!text-gray-600 disabled:opacity-100 sm:w-auto"
        >
          {isLoading ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}
