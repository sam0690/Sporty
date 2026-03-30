"use client";

type LeaderboardFiltersProps = {
  selectedGroup: string;
  groups: string[];
  onGroupChange?: (group: string) => void;
};

export function LeaderboardFilters({ selectedGroup, groups, onGroupChange }: LeaderboardFiltersProps) {
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
                ? "bg-primary-500 text-white"
                : "bg-surface-100 text-text-secondary hover:bg-surface-200"
            }`}
          >
            {group}
          </button>
        );
      })}
    </section>
  );
}
