"use client";
type Sport = "football" | "basketball" | "cricket" | "multisport";

type CreateTeamHeaderProps = {
  leagueName: string;
  sport: Sport;
  budget: number;
  remainingBudget: number;
  step: number;
  totalSteps: number;
  selectedCount: number;
  requiredCount: number;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/15 text-accent-football",
  basketball: "bg-accent-basketball/15 text-accent-basketball",
  cricket: "bg-accent-cricket/15 text-accent-cricket",
  multisport:
    "bg-gradient-to-r from-accent-football/15 via-accent-basketball/15 to-accent-cricket/15 text-primary",
};

function stepLabel(step: number): string {
  if (step === 1) return "Pick Players";
  if (step === 2) return "Name Your Team";
  return "Confirmation";
}

export function CreateTeamHeader({
  leagueName,
  sport,
  budget,
  remainingBudget,
  step,
  totalSteps,
  selectedCount,
  requiredCount,
}: CreateTeamHeaderProps) {
  const progress = Math.min(
    100,
    Math.round((selectedCount / Math.max(requiredCount, 1)) * 100),
  );

  return (
    <header className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-600 tracking-[2px] text-[#f0f0f0]">
              {leagueName}
            </h1>
            {sport === "multisport" ? (
              <span
                className={`inline-flex items-center gap-2 rounded-[3px] px-3 py-1 text-xs ${sportBadgeStyles[sport]}`}
              >
                <span>⚽</span>
                <span>🏀</span>
                <span>🏏</span>
                <span>Multi-Sport</span>
              </span>
            ) : (
              <span
                className={`rounded-[3px] px-3 py-1 text-xs capitalize ${sportBadgeStyles[sport]}`}
              >
                {sport}
              </span>
            )}
          </div>
          <p className="text-sm text-[#555560]">
            Step {step} of {totalSteps}: {stepLabel(step)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-[#555560]">Budget: ${budget}</p>
          <p
            className={`text-sm font-600 ${remainingBudget >= 0 ? "text-[#e8fb25]" : "text-red-400"}`}
          >
            ${remainingBudget} remaining
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 rounded-[3px] bg-[#1d1d26]">
          <div
            className="h-2 rounded-[3px] bg-linear-to-r [#e8fb25]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-[#555560]">
          {selectedCount}/{requiredCount} players selected
        </p>
      </div>
    </header>
  );
}
