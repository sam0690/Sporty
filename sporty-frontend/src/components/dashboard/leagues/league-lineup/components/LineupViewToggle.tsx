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
            ? "border border-accent-primary/30 bg-accent-primary/10 text-accent-primary"
            : "border border-white/10 bg-white/5 text-foreground/75 hover:bg-white/8"
        }`}
      >
        List View
      </button>
      <button
        type="button"
        onClick={() => onChange("pitch")}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          value === "pitch"
            ? "border border-accent-primary/30 bg-accent-primary/10 text-accent-primary"
            : "border border-white/10 bg-white/5 text-foreground/75 hover:bg-white/8"
        }`}
      >
        Pitch View
      </button>
    </div>
  );
}
