"use client";

import { SportIcon } from "@/components/landing/sport-icons";

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
  basketball: [
    "PointGuard",
    "ShootingGuard",
    "SmallForward",
    "PowerForward",
    "Center",
  ],
  cricket: ["Batsman", "Bowler", "AllRounder", "WicketKeeper"],
} as const;

const SPORT_META = {
  football: {
    label: "Football",
    badge: "bg-accent-football/10 text-accent-football",
  },
  basketball: {
    label: "Basketball",
    badge: "bg-accent-basketball/10 text-accent-basketball",
  },
  cricket: {
    label: "Cricket",
    badge: "bg-accent-cricket/10 text-accent-cricket",
  },
} as const;

export function PositionLimits({
  limits,
  currentCounts,
  isMultiSport = false,
}: PositionLimitsProps) {
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
          const sportKey = (
            Object.keys(SPORT_POSITION_GROUPS) as Array<
              keyof typeof SPORT_POSITION_GROUPS
            >
          ).find((key) =>
            SPORT_POSITION_GROUPS[key].includes(position as never),
          );
          return (
            <div
              key={position}
              className="flex items-center gap-2 rounded-sm border border-border bg-surface-muted px-4 py-1.5 font-condensed text-xs font-bold uppercase tracking-[0.06em]"
            >
              <span className="flex items-center gap-1.5 text-ink-muted">
                {sportKey ? (
                  <SportIcon sport={sportKey} className="h-3 w-3" tint />
                ) : null}
                {position}
              </span>
              <span
                className={`tabular-nums ${atLimit ? "text-[#DC2626]" : "text-[#6B7280]"}`}
              >
                {current}/{max}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
