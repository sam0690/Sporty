"use client";

type StatTileProps = {
  label: string;
  value: string | number;
  size?: "sm" | "default" | "hero";
  tone?: "accent" | "neutral";
  className?: string;
};

const sizeClass: Record<NonNullable<StatTileProps["size"]>, string> = {
  sm: "text-2xl",
  default: "text-3xl",
  hero: "text-5xl sm:text-6xl",
};

export function StatTile({
  label,
  value,
  size = "default",
  tone = "accent",
  className = "",
}: StatTileProps) {
  return (
    <div className={className}>
      <p
        className={`num font-display leading-none tracking-[-0.02em] ${sizeClass[size]} ${
          tone === "accent" ? "text-accent" : "text-fg-1"
        }`}
      >
        {value}
      </p>
      <p className="section-label mt-1.5">{label}</p>
    </div>
  );
}
