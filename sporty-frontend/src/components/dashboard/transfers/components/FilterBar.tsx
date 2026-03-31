"use client";

type Sport = "All" | "football" | "basketball" | "cricket";

type FilterBarProps = {
  selectedSport: Sport;
  selectedPosition: string;
  onSportChange: (sport: Sport) => void;
  onPositionChange: (position: string) => void;
};

const sports: Sport[] = ["All", "football", "basketball", "cricket"];

const positionMap: Record<Exclude<Sport, "All">, string[]> = {
  football: ["All", "Forward", "Midfielder", "Defender", "Goalkeeper"],
  basketball: ["All", "Guard", "Forward", "Center"],
  cricket: ["All", "Batsman", "Bowler", "All-Rounder", "Wicketkeeper"],
};

export function FilterBar({
  selectedSport,
  selectedPosition,
  onSportChange,
  onPositionChange,
}: FilterBarProps) {
  const positionOptions =
    selectedSport === "All"
      ? ["All"]
      : positionMap[selectedSport];

  return (
    <section className="flex flex-wrap items-center gap-2">
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
            className={`rounded-lg px-3 py-2 text-sm capitalize transition-colors ${
              isActive
                ? "bg-primary-500 text-white"
                : "bg-surface-100 text-text-secondary hover:bg-surface-200"
            }`}
          >
            {sport}
          </button>
        );
      })}

      <select
        value={selectedPosition}
        onChange={(event) => onPositionChange(event.target.value)}
        className="rounded-lg border border-border bg-surface-100 px-3 py-2 text-sm text-text-primary"
      >
        {positionOptions.map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>
    </section>
  );
}

export type { Sport };
