"use client";

import { useRouter } from "next/navigation";

type TabKey =
  | "overview"
  | "lineup"
  | "roster"
  | "leaderboard"
  | "members"
  | "invite"
  | "settings";

type NavigationTabsProps = {
  activeTab: TabKey;
  leagueId: string;
  isCommissioner?: boolean;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "lineup", label: "Lineup" },
  { key: "roster", label: "Roster" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "members", label: "Members" },
  { key: "invite", label: "Invite" },
  { key: "settings", label: "Settings" },
];

export function NavigationTabs({
  activeTab,
  leagueId,
  isCommissioner = false,
}: NavigationTabsProps) {
  const router = useRouter();

  const goToTab = (tab: TabKey) => {
    if (tab === "overview") {
      router.push(`/leagues/${leagueId}`);
      return;
    }

    if (tab === "lineup") {
      router.push(`/leagues/${leagueId}/lineup`);
      return;
    }

    if (tab === "roster") {
      router.push(`/leagues/${leagueId}/roster`);
      return;
    }

    if (tab === "leaderboard") {
      router.push(`/leagues/${leagueId}/leaderboard`);
      return;
    }

    if (tab === "members") {
      router.push(`/leagues/${leagueId}/members`);
      return;
    }

    if (tab === "invite") {
      router.push(`/leagues/${leagueId}/invite`);
      return;
    }

    router.push(`/leagues/${leagueId}/settings`);
  };

  return (
    <nav
      className="mb-6 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-2"
      aria-label="League Navigation Tabs"
    >
      <div className="flex min-w-max gap-2">
        {tabs
          .filter((tab) => tab.key !== "settings" || isCommissioner)
          .map((tab) => {
            const isActive = tab.key === activeTab;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => goToTab(tab.key)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "border-primary-200 bg-primary-50 text-primary-900 shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
      </div>
    </nav>
  );
}

export type { TabKey };
