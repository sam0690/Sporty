"use client";

type InitialLineupBoardProps = {
  sportLabel: string;
  sportType: "football" | "basketball" | "multisport";
  requiredStarters: number;
  requiredBench: number;
  selectedStarterCount: number;
};

export function InitialLineupBoard({
  sportLabel,
  sportType,
  requiredStarters,
  requiredBench,
  selectedStarterCount,
}: InitialLineupBoardProps) {
  const starterSlots = Array.from(
    { length: requiredStarters },
    (_, i) => i + 1,
  );
  const benchSlots = Array.from({ length: requiredBench }, (_, i) => i + 1);

  const starterBackground =
    sportType === "football"
      ? "bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent"
      : sportType === "basketball"
        ? "bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent"
        : "bg-gradient-to-b from-slate-500/10 via-slate-500/5 to-transparent";

  const starterLabel =
    sportType === "football"
      ? "Pitch Slots"
      : sportType === "basketball"
        ? "Court Slots"
        : "Starter Slots";

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          First-Time Lineup Setup: {sportLabel}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/75">
          {selectedStarterCount} / {requiredStarters} selected
        </span>
      </div>

      <div
        className={`rounded-2xl border border-white/10 p-4 ${starterBackground}`}
      >
        <p className="mb-3 text-sm font-medium text-foreground">
          {starterLabel}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {starterSlots.map((slot) => {
            const filled = slot <= selectedStarterCount;
            return (
              <div
                key={`starter-slot-${slot}`}
                className={`rounded-lg border border-dashed p-3 text-center text-xs font-medium ${
                  filled
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-foreground/55"
                }`}
              >
                Starter Slot {slot}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Bench Slots</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {benchSlots.map((slot) => (
            <div
              key={`bench-slot-${slot}`}
              className="rounded-lg border border-dashed border-white/10 bg-white/5 p-3 text-center text-xs font-medium text-foreground/55"
            >
              Bench Slot {slot}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-foreground/50">
        Tap players below to fill starter slots. Drag-and-drop can be added
        later without changing this validation flow.
      </p>
    </section>
  );
}
