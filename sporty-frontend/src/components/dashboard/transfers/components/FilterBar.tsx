"use client";

type Sport = "All" | "football" | "basketball" | "cricket";

type FilterBarProps = {
  selectedSport: Sport;
  selectedPosition: string;
  availableSports?: Exclude<Sport, "All">[];
  positionOptionsBySport?: Partial<Record<Sport, string[]>>;
  onSportChange: (sport: Sport) => void;
  onPositionChange: (position: string) => void;
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
  availableSports,
  positionOptionsBySport,
  onSportChange,
  onPositionChange,
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
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all ${
                isActive
                  ? "border-primary-500 bg-primary/100 text-white"
                  : "border-border bg-white text-secondary hover:border-border"
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
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all ${
                  isActive
                    ? "border-primary-500 bg-primary/100 text-white"
                    : "border-border bg-white text-secondary hover:border-border"
                }`}
              >
                {position}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export type { Sport };
