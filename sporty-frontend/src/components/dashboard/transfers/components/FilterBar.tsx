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

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-[3px] border px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] transition-colors ${
      active
        ? "border-[rgba(232,251,37,0.4)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]"
        : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5] hover:text-[#f0f0f0]"
    }`;

  const costInput =
    "w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-3 py-2 text-sm text-[#f0f0f0] outline-none transition-colors focus:border-[#e8fb25]";

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
        <label className="space-y-1.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#9a9aa5]">
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

        <label className="space-y-1.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#9a9aa5]">
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
