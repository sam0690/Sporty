"use client";

type LineupViewToggleProps = {
  value: "list" | "pitch";
  onChange: (mode: "list" | "pitch") => void;
};

export function LineupViewToggle({ value, onChange }: LineupViewToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`rounded-[3px] px-4 py-2 text-sm transition-colors ${
          value === "list"
            ? "border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]"
            : "border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#f0f0f0]/75 hover:bg-[#1d1d26]"
        }`}
      >
        List View
      </button>
      <button
        type="button"
        onClick={() => onChange("pitch")}
        className={`rounded-[3px] px-4 py-2 text-sm transition-colors ${
          value === "pitch"
            ? "border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]"
            : "border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#f0f0f0]/75 hover:bg-[#1d1d26]"
        }`}
      >
        Pitch View
      </button>
    </div>
  );
}
