"use client";

type RosterFiltersProps = {
  positions: string[];
  selectedPosition: string;
  onPositionChange: (position: string) => void;
  sports?: string[];
  selectedSport?: string;
  onSportChange?: (sport: string) => void;
};

export function RosterFilters({
  positions,
  selectedPosition,
  onPositionChange,
  sports = [],
  selectedSport = "All",
  onSportChange,
}: RosterFiltersProps) {
  return (
    <section className="space-y-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      {sports.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sports.map((sport) => {
            const active = selectedSport === sport;
            return (
              <button
                key={sport}
                type="button"
                onClick={() => onSportChange?.(sport)}
                className={`rounded-[3px] px-3 py-2 text-sm capitalize transition-colors ${
                  active
                    ? "border border-[rgba(232,251,37,0.2)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]"
                    : "border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#f0f0f0] hover:bg-[#1d1d26]"
                }`}
              >
                {sport}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="position-filter" className="text-sm text-[#555560]">
          Position
        </label>
        <select
          id="position-filter"
          value={selectedPosition}
          onChange={(event) => onPositionChange(event.target.value)}
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] outline-none"
        >
          {positions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
