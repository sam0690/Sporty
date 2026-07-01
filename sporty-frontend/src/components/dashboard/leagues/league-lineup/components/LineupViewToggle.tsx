"use client";

type LineupViewToggleProps = {
  value: "list" | "pitch";
  onChange: (mode: "list" | "pitch") => void;
};

export function LineupViewToggle({ value, onChange }: LineupViewToggleProps) {
  const buttonClass = (active: boolean) =>
    `rounded-[3px] border px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] transition-colors ${
      active
        ? "border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
        : "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280] hover:text-[#0B1220]"
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
