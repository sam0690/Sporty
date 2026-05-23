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
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "border-accent-primary/30 bg-white/10 text-foreground shadow-[0_0_0_1px_rgba(0,229,255,0.16)]"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-accent-primary/20 hover:bg-white/8 hover:text-foreground"
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
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "border-accent-primary/30 bg-white/10 text-foreground shadow-[0_0_0_1px_rgba(0,229,255,0.16)]"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-accent-primary/20 hover:bg-white/8 hover:text-foreground"
                }`}
              >
                {position}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Min cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={minCost}
            onChange={(event) => onMinCostChange(event.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          />
        </label>

        <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Max cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={maxCost}
            onChange={(event) => onMaxCostChange(event.target.value)}
            placeholder="Any"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          />
        </label>
      </div>
    </section>
  );
}

export type { Sport };
