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

const sportBadgeClass: Record<Sport, string> = {
  football: "sport-badge-football",
  basketball: "sport-badge-basketball",
  cricket: "sport-badge-cricket",
  multisport: "sport-badge-multisport",
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
  const overBudget = remainingBudget < 0;

  return (
    <header className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-bebas text-4xl leading-none tracking-[2px] text-[#f0f0f0]">
              {leagueName}
            </h1>
            <span
              className={`rounded-[3px] px-2.5 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] ${sportBadgeClass[sport]}`}
              aria-label={sport}
            >
              {sport === "multisport" ? "Multi-Sport" : sport}
            </span>
          </div>
          <p className="section-label">
            Step {step} of {totalSteps} · {stepLabel(step)}
          </p>
        </div>

        <div className="text-right">
          <p className="section-label">Budget ${budget}</p>
          <p
            className={`mt-1 font-bebas text-2xl tracking-[1px] tabular-nums ${
              overBudget ? "text-[#ff3b30]" : "text-[#e8fb25]"
            }`}
          >
            ${remainingBudget} left
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-[3px] bg-[#0d0d12]">
          <div
            className="h-2 rounded-[3px] bg-[#e8fb25] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
          {selectedCount}/{requiredCount} players selected
        </p>
      </div>
    </header>
  );
}
