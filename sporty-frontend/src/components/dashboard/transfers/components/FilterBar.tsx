"use client";

type Sport = "All" | "football" | "basketball";

type FilterBarProps = {
  selectedSport: Sport;
  selectedPosition: string;
  onSportChange: (sport: Sport) => void;
  onPositionChange: (position: string) => void;
};

const sports: Sport[] = ["All", "football", "basketball"];

const sportLabels: Record<Sport, string> = {
  All: "All",
  football: "⚽ Football",
  basketball: "🏀 Basketball",
};

const positionMap: Record<Exclude<Sport, "All">, string[]> = {
  football: ["All", "Forward", "Midfielder", "Defender", "Goalkeeper"],
  basketball: ["All", "Guard", "Forward", "Center"],
};

export function FilterBar({
  selectedSport,
  selectedPosition,
  onSportChange,
  onPositionChange,
}: FilterBarProps) {
  const positionOptions =
    selectedSport === "All" ? ["All"] : positionMap[selectedSport];

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
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
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
                    ? "border-primary-500 bg-primary-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
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
