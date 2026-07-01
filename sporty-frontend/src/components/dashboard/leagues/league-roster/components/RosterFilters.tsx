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
    <section className="space-y-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4 ">
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
                    ? "border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
                    : "border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#0B1220] hover:bg-[#F3F4F7]"
                }`}
              >
                {sport}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="position-filter" className="text-sm text-[#6B7280]">
          Position
        </label>
        <select
          id="position-filter"
          value={selectedPosition}
          onChange={(event) => onPositionChange(event.target.value)}
          className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-3 py-2 text-sm text-[#0B1220] outline-none"
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
