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
    <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
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
                    ? "border border-accent-primary/20 bg-accent-primary/10 text-accent-primary"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/8"
                }`}
              >
                {sport}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="position-filter" className="text-sm text-slate-400">
          Position
        </label>
        <select
          id="position-filter"
          value={selectedPosition}
          onChange={(event) => onPositionChange(event.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none"
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
