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
    <header className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {leagueName}
            </h1>
            {sport === "multisport" ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${sportBadgeStyles[sport]}`}
              >
                <span>⚽</span>
                <span>🏀</span>
                <span>🏏</span>
                <span>Multi-Sport</span>
              </span>
            ) : (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${sportBadgeStyles[sport]}`}
              >
                {sport}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            Step {step} of {totalSteps}: {stepLabel(step)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-slate-400">Budget: ${budget}</p>
          <p
            className={`text-sm font-semibold ${remainingBudget >= 0 ? "text-accent-primary" : "text-red-400"}`}
          >
            ${remainingBudget} remaining
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 rounded-full bg-white/8">
          <div
            className="h-2 rounded-full bg-linear-to-r from-accent-primary to-accent-secondary"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">
          {selectedCount}/{requiredCount} players selected
        </p>
      </div>
    </header>
  );
}
