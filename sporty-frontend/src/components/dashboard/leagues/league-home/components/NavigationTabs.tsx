"use client";

import { useRouter } from "next/navigation";

type TabKey = "lineup" | "roster" | "transfers" | "leaderboard";

type NavigationTabsProps = {
  activeTab: TabKey;
  leagueId: string;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "lineup", label: "Lineup" },
  { key: "roster", label: "Roster" },
  { key: "transfers", label: "Transfers" },
  { key: "leaderboard", label: "Leaderboard" },
];

export function NavigationTabs({ activeTab, leagueId }: NavigationTabsProps) {
  const router = useRouter();

  const goToTab = (tab: TabKey) => {
    if (tab === "lineup") {
      router.push(`/league/${leagueId}/lineup`);
      return;
    }

    if (tab === "roster") {
      router.push(`/league/${leagueId}/roster`);
      return;
    }

    if (tab === "transfers") {
      router.push("/transfers");
      return;
    }

    router.push(`/league/${leagueId}/leaderboard`);
  };

  return (
    <nav className="flex flex-wrap gap-6 border-b border-border" aria-label="League Navigation Tabs">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => goToTab(tab.key)}
            className={`pb-3 text-sm font-medium transition-colors ${
              isActive
                ? "border-b-2 border-primary-500 text-primary-600"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export type { TabKey };
