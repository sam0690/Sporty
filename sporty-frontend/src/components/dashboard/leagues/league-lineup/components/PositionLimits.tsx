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

  const orderedPositions = isMultiSport
    ? [
        ...SPORT_POSITION_GROUPS.football,
        ...SPORT_POSITION_GROUPS.basketball,
        ...SPORT_POSITION_GROUPS.cricket,
      ].filter((position) => position in limits)
    : positions;

  return (
    <section className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-2">
        {orderedPositions.map((position) => {
          const max = limits[position].max;
          const current = currentCounts[position] ?? 0;
          const atLimit = current >= max;
          const sportKey = (Object.keys(SPORT_POSITION_GROUPS) as Array<keyof typeof SPORT_POSITION_GROUPS>).find((key) =>
            SPORT_POSITION_GROUPS[key].includes(position as never),
          );
          const sportIcon = sportKey ? `${SPORT_META[sportKey].icon} ` : "";

          return (
            <div
              key={position}
              className="rounded-full border border-accent/20 bg-white px-4 py-1.5 text-sm text-secondary"
            >
              <span className="mr-1 text-secondary">{sportIcon}</span>
              <span>{position}</span>
              <span className={`ml-2 font-medium ${atLimit ? "text-amber-600" : "text-black"}`}>
                {current}/{max}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
