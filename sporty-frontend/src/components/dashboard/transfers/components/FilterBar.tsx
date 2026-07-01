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
  football: "Football",
  basketball: "Basketball",
  cricket: "Cricket",
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

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-[3px] border px-3.5 py-1.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] transition-colors ${
      active
        ? "border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
        : "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280] hover:text-[#0B1220]"
    }`;

  const costInput =
    "w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]";

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
            {sportLabels[sport]}
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
        <label className="space-y-1.5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#6B7280]">
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

        <label className="space-y-1.5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#6B7280]">
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
