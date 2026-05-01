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
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          value === "list"
            ? "bg-primary text-white"
            : "border border-border bg-white text-black hover:bg-[#F4F4F9]"
        }`}
      >
        List View
      </button>
      <button
        type="button"
        onClick={() => onChange("pitch")}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          value === "pitch"
            ? "bg-primary text-white"
            : "border border-border bg-white text-black hover:bg-[#F4F4F9]"
        }`}
      >
        Pitch View
      </button>
    </div>
  );
}
