"use client";

type PositionLimit = {
  max: number;
  current: number;
};

type PositionLimitsProps = {
  limits: Record<string, PositionLimit>;
  currentCounts: Record<string, number>;
  isMultiSport?: boolean;
};

const SPORT_POSITION_GROUPS = {
  football: ["Forward", "Midfielder", "Defender", "Goalkeeper"],
  basketball: ["PointGuard", "ShootingGuard", "SmallForward", "PowerForward", "Center"],
  cricket: ["Batsman", "Bowler", "AllRounder", "WicketKeeper"],
} as const;

const SPORT_META = {
  football: {
    label: "Football",
    icon: "⚽",
    badge: "bg-accent-football/10 text-accent-football",
  },
  basketball: {
    label: "Basketball",
    icon: "🏀",
    badge: "bg-accent-basketball/10 text-accent-basketball",
  },
  cricket: {
    label: "Cricket",
    icon: "🏏",
    badge: "bg-accent-cricket/10 text-accent-cricket",
  },
} as const;

export function PositionLimits({ limits, currentCounts, isMultiSport = false }: PositionLimitsProps) {
  const positions = Object.keys(limits);

  const progressClass = (percentage: number): string => {
    if (percentage >= 100) return "w-full";
    if (percentage >= 75) return "w-3/4";
    if (percentage >= 50) return "w-1/2";
    if (percentage >= 25) return "w-1/4";
    return "w-0";
  };

  return (
    <section className="rounded-lg bg-surface-100 p-4 shadow-card">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">Position Limits</h2>
      {isMultiSport ? (
        <div className="space-y-4">
          {(Object.keys(SPORT_POSITION_GROUPS) as Array<keyof typeof SPORT_POSITION_GROUPS>).map((sportKey) => {
            const meta = SPORT_META[sportKey];
            const sportPositions = SPORT_POSITION_GROUPS[sportKey].filter((position) => position in limits);

            if (sportPositions.length === 0) {
              return null;
            }

            return (
              <div key={sportKey} className="rounded-lg border border-border p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${meta.badge}`}>
                    {meta.icon} {meta.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sportPositions.map((position) => {
                    const max = limits[position].max;
                    const current = currentCounts[position] ?? 0;
                    const percentage = Math.min(100, Math.round((current / max) * 100));
                    const atLimit = current >= max;

                    return (
                      <div key={position} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium text-text-primary">{position}</p>
                        <p className={`mt-1 text-xs ${atLimit ? "text-yellow-600" : "text-text-secondary"}`}>
                          {current}/{max} filled
                        </p>
                        <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                          <div className={`h-2 rounded-full bg-primary-500 ${progressClass(percentage)}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {positions.map((position) => {
            const max = limits[position].max;
            const current = currentCounts[position] ?? 0;
            const percentage = Math.min(100, Math.round((current / max) * 100));
            const atLimit = current >= max;

            return (
              <div key={position} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-text-primary">{position}</p>
                <p className={`mt-1 text-xs ${atLimit ? "text-yellow-600" : "text-text-secondary"}`}>
                  {current}/{max} filled
                </p>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                  <div className={`h-2 rounded-full bg-primary-500 ${progressClass(percentage)}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
