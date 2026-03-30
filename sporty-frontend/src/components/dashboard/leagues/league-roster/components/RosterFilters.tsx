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
    <section className="space-y-3 rounded-lg bg-surface-100 p-4 shadow-card">
      {sports.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sports.map((sport) => {
            const active = selectedSport === sport;
            return (
              <button
                key={sport}
                type="button"
                onClick={() => onSportChange?.(sport)}
                className={`rounded-lg px-3 py-2 text-sm capitalize transition-colors ${
                  active
                    ? "bg-primary-500 text-white"
                    : "bg-surface-100 text-text-secondary hover:bg-surface-200"
                }`}
              >
                {sport}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="position-filter" className="text-sm text-text-secondary">Position</label>
        <select
          id="position-filter"
          value={selectedPosition}
          onChange={(event) => onPositionChange(event.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary"
        >
          {positions.map((position) => (
            <option key={position} value={position}>{position}</option>
          ))}
        </select>
      </div>
    </section>
  );
}
