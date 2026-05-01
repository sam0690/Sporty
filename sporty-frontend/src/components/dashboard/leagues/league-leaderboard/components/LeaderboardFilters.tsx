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
                ? "bg-primary/100 text-white"
                : "bg-[#F4F4F9] text-secondary hover:bg-white-200"
            }`}
          >
            {group}
          </button>
        );
      })}
    </section>
  );
}
