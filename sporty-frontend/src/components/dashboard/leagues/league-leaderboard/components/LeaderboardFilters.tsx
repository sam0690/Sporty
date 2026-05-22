"use client";

type LeaderboardFiltersProps = {
  selectedGroup: string;
  groups: string[];
  onGroupChange?: (group: string) => void;
};

export function LeaderboardFilters({
  selectedGroup,
  groups,
  onGroupChange,
}: LeaderboardFiltersProps) {
  return (
    <section className="flex flex-wrap gap-2">
      {groups.map((group) => {
        const isActive = selectedGroup === group;

        return (
          <button
            key={group}
            type="button"
            onClick={() => onGroupChange?.(group)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border border-accent-primary/30 bg-accent-primary/10 text-accent-primary"
                : "border border-white/10 bg-white/5 text-foreground/70 hover:bg-white/8"
            }`}
          >
            {group}
          </button>
        );
      })}
    </section>
  );
}
