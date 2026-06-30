"use client";

type LineupViewToggleProps = {
  value: "list" | "pitch";
  onChange: (mode: "list" | "pitch") => void;
};

export function LineupViewToggle({ value, onChange }: LineupViewToggleProps) {
  const buttonClass = (active: boolean) =>
    `rounded-[3px] border px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] transition-colors ${
      active
        ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]"
        : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5] hover:text-[#f0f0f0]"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={buttonClass(value === "list")}
      >
        List View
      </button>
      <button
        type="button"
        onClick={() => onChange("pitch")}
        className={buttonClass(value === "pitch")}
      >
        Pitch View
      </button>
    </div>
  );
}
