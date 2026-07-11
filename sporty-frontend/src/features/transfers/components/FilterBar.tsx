"use client";

import {
  POSITION_MAP,
  SPORT_LABELS,
  type PlayerFilterSport as Sport,
} from "@/lib/playerPositions";

type FilterBarProps = {
  selectedSport: Sport;
  selectedPosition: string;
  minCost: string;
  maxCost: string;
  availableSports?: Exclude<Sport, "All">[];
  positionOptionsBySport?: Partial<Record<Sport, string[]>>;
  onSportChange: (sport: Sport) => void;
  onPositionChange: (position: string) => void;
  onMinCostChange: (value: string) => void;
  onMaxCostChange: (value: string) => void;
};

const defaultSports: Exclude<Sport, "All">[] = [
  "football",
  "basketball",
  "cricket",
];

export function FilterBar({
  selectedSport,
  selectedPosition,
  minCost,
  maxCost,
  availableSports,
  positionOptionsBySport,
  onSportChange,
  onPositionChange,
  onMinCostChange,
  onMaxCostChange,
}: FilterBarProps) {
  const leagueSports =
    availableSports && availableSports.length > 0
      ? availableSports
      : defaultSports;
  const sports: Sport[] = ["All", ...leagueSports];

  const dynamicAllPositions =
    positionOptionsBySport?.All && positionOptionsBySport.All.length > 0
      ? positionOptionsBySport.All
      : ["All"];
  const dynamicSportPositions =
    selectedSport !== "All" &&
    positionOptionsBySport?.[selectedSport] &&
    positionOptionsBySport[selectedSport]!.length > 0
      ? positionOptionsBySport[selectedSport]!
      : selectedSport === "All"
        ? dynamicAllPositions
        : POSITION_MAP[selectedSport];

  const positionOptions =
    selectedSport === "All" ? dynamicAllPositions : dynamicSportPositions;

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-[3px] border px-3.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1.5px] transition-colors ${
      active
        ? "border-accent/40 bg-accent/10 text-accent"
        : "border-white/8 bg-surface-3 text-fg-2 hover:text-fg-1"
    }`;

  const costInput =
    "w-full rounded-[3px] border border-white/8 bg-surface-2 px-3 py-2 text-sm text-fg-1 outline-none transition-colors focus:border-accent";

  return (
    <section className="space-y-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {sports.map((sport) => (
          <button
            key={sport}
            type="button"
            onClick={() => {
              onSportChange(sport);
              onPositionChange("All");
            }}
            className={chip(selectedSport === sport)}
          >
            {SPORT_LABELS[sport]}
          </button>
        ))}
      </div>

      {positionOptions.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {positionOptions.map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => onPositionChange(position)}
              className={chip(selectedPosition === position)}
            >
              {position}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
          <span>Min cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={minCost}
            onChange={(event) => onMinCostChange(event.target.value)}
            placeholder="0"
            className={costInput}
          />
        </label>

        <label className="space-y-1.5 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
          <span>Max cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={maxCost}
            onChange={(event) => onMaxCostChange(event.target.value)}
            placeholder="Any"
            className={costInput}
          />
        </label>
      </div>
    </section>
  );
}

export type { Sport };
