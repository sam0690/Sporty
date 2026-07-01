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
            className={`rounded-[3px] px-3 py-2 text-sm transition-colors ${
              isActive
                ? "border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
                : "border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280] hover:bg-[#F3F4F7]"
            }`}
          >
            {group}
          </button>
        );
      })}
    </section>
  );
}
