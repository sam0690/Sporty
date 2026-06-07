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
                ? "border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]"
                : "border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560] hover:bg-[#1d1d26]"
            }`}
          >
            {group}
          </button>
        );
      })}
    </section>
  );
}
