"use client";

type Sport = "All" | "football" | "basketball" | "cricket";

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

const sportLabels: Record<Sport, string> = {
  All: "All",
  football: "⚽ Football",
  basketball: "🏀 Basketball",
  cricket: "🏏 Cricket",
};

const positionMap: Record<Exclude<Sport, "All">, string[]> = {
  football: ["All", "Forward", "Midfielder", "Defender", "Goalkeeper"],
  basketball: ["All", "Guard", "Forward", "Center"],
  cricket: ["All", "Batter", "Bowler", "All-Rounder", "Wicketkeeper"],
};

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
        : positionMap[selectedSport];

  const positionOptions =
    selectedSport === "All" ? dynamicAllPositions : dynamicSportPositions;

  return (
    <section className="space-y-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {sports.map((sport) => {
          const isActive = selectedSport === sport;

          return (
            <button
              key={sport}
              type="button"
              onClick={() => {
                onSportChange(sport);
                onPositionChange("All");
              }}
              className={`whitespace-nowrap rounded-[3px] border px-4 py-2 text-sm transition-all ${
                isActive
                  ? "border-[rgba(232,251,37,0.3)] bg-[#1d1d26] text-[#f0f0f0]"
                  : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#f0f0f0] hover:border-[rgba(232,251,37,0.2)] hover:bg-[#1d1d26] hover:text-[#f0f0f0]"
              }`}
            >
              {sportLabels[sport]}
            </button>
          );
        })}
      </div>

      {positionOptions.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {positionOptions.map((position) => {
            const isActive = selectedPosition === position;

            return (
              <button
                key={position}
                type="button"
                onClick={() => onPositionChange(position)}
                className={`whitespace-nowrap rounded-[3px] border px-4 py-2 text-sm transition-all ${
                  isActive
                    ? "border-[rgba(232,251,37,0.3)] bg-[#1d1d26] text-[#f0f0f0]"
                    : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#f0f0f0] hover:border-[rgba(232,251,37,0.2)] hover:bg-[#1d1d26] hover:text-[#f0f0f0]"
                }`}
              >
                {position}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs uppercase tracking-wide text-[#555560]">
          <span>Min cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={minCost}
            onChange={(event) => onMinCostChange(event.target.value)}
            placeholder="0"
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          />
        </label>

        <label className="space-y-1 text-xs uppercase tracking-wide text-[#555560]">
          <span>Max cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={maxCost}
            onChange={(event) => onMaxCostChange(event.target.value)}
            placeholder="Any"
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          />
        </label>
      </div>
    </section>
  );
}

export type { Sport };
