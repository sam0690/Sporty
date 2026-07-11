"use client";

type LineupViewToggleProps = {
  value: "list" | "pitch";
  onChange: (mode: "list" | "pitch") => void;
};

export function LineupViewToggle({ value, onChange }: LineupViewToggleProps) {
  const buttonClass = (active: boolean) =>
    `rounded-[3px] border px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] transition-colors ${
      active
        ? "border-accent/30 bg-accent/10 text-accent"
        : "border-white/8 bg-surface-3 text-fg-2 hover:text-fg-1"
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
