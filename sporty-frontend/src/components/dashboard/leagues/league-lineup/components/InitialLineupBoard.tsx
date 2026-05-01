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
      ? "bg-gradient-to-b from-emerald-100 via-emerald-50 to-white"
      : sportType === "basketball"
        ? "bg-gradient-to-b from-orange-100 via-amber-50 to-white"
        : "bg-gradient-to-b from-slate-100 via-slate-50 to-white";

  const starterLabel =
    sportType === "football"
      ? "Pitch Slots"
      : sportType === "basketball"
        ? "Court Slots"
        : "Starter Slots";

  return (
    <section className="space-y-4 rounded-lg border border-border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-black">
          First-Time Lineup Setup: {sportLabel}
        </h2>
        <span className="rounded-full border border-border bg-[#F4F4F9] px-3 py-1 text-xs font-medium text-black">
          {selectedStarterCount} / {requiredStarters} selected
        </span>
      </div>

      <div
        className={`rounded-md border border-border p-4 ${starterBackground}`}
      >
        <p className="mb-3 text-sm font-medium text-black">{starterLabel}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {starterSlots.map((slot) => {
            const filled = slot <= selectedStarterCount;
            return (
              <div
                key={`starter-slot-${slot}`}
                className={`rounded-lg border border-dashed p-3 text-center text-xs font-medium ${
                  filled
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-border bg-white text-secondary"
                }`}
              >
                Starter Slot {slot}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-border bg-[#F4F4F9] p-4">
        <p className="mb-3 text-sm font-medium text-black">Bench Slots</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {benchSlots.map((slot) => (
            <div
              key={`bench-slot-${slot}`}
              className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-medium text-slate-600"
            >
              Bench Slot {slot}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-secondary">
        Tap players below to fill starter slots. Drag-and-drop can be added
        later without changing this validation flow.
      </p>
    </section>
  );
}
