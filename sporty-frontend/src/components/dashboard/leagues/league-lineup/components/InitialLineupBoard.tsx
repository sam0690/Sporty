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
    <section className="space-y-4 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-5 ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#0B1220]">
          First-Time Lineup Setup: {sportLabel}
        </h2>
        <span className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-3 py-1 text-xs text-[#0B1220]/75">
          {selectedStarterCount} / {requiredStarters} selected
        </span>
      </div>

      <div
        className={`rounded-[3px] border border-[rgba(11,18,32,0.08)] p-4 ${starterBackground}`}
      >
        <p className="mb-3 text-sm text-[#0B1220]">
          {starterLabel}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {starterSlots.map((slot) => {
            const filled = slot <= selectedStarterCount;
            return (
              <div
                key={`starter-slot-${slot}`}
                className={`rounded-[3px] border border-dashed p-3 text-center text-xs ${
                  filled
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    : "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280]"
                }`}
              >
                Starter Slot {slot}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4">
        <p className="mb-3 text-sm text-[#0B1220]">Bench Slots</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {benchSlots.map((slot) => (
            <div
              key={`bench-slot-${slot}`}
              className="rounded-[3px] border border-dashed border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-3 text-center text-xs text-[#6B7280]"
            >
              Bench Slot {slot}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[#0B1220]/50">
        Tap players below to fill starter slots. Drag-and-drop can be added
        later without changing this validation flow.
      </p>
    </section>
  );
}
