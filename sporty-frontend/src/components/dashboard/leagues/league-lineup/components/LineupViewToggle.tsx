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
            ? "bg-primary-600 text-white"
            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        List View
      </button>
      <button
        type="button"
        onClick={() => onChange("pitch")}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          value === "pitch"
            ? "bg-primary-600 text-white"
            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        Pitch View
      </button>
    </div>
  );
}
