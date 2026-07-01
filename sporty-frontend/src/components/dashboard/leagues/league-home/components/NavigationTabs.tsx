"use client";

import { useRouter } from "next/navigation";

type TabKey =
  | "overview"
  | "lineup"
  | "gameweek"
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
  { key: "gameweek", label: "Gameweek" },
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
    const routes: Record<TabKey, string> = {
      overview:    `/leagues/${leagueId}`,
      lineup:      `/leagues/${leagueId}/lineup`,
      gameweek:    `/leagues/${leagueId}/gameweek`,
      leaderboard: `/leagues/${leagueId}/leaderboard`,
      members:     `/leagues/${leagueId}/members`,
      invite:      `/leagues/${leagueId}/invite`,
      settings:    `/leagues/${leagueId}/settings`,
    };
    router.push(routes[tab]);
  };

  return (
    <nav
      className="mb-6 overflow-x-auto rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-1"
      aria-label="League Navigation Tabs"
    >
      <div className="flex min-w-max gap-1">
        {tabs
          .filter((tab) => tab.key !== "settings" || isCommissioner)
          .map((tab) => {
            const isActive = tab.key === activeTab;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => goToTab(tab.key)}
                className={`rounded-[3px] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] transition-colors ${
                  isActive
                    ? "bg-[#e8fb25] text-[#0a0a0f]"
                    : "bg-transparent text-[#555560] hover:bg-[#1d1d26] hover:text-[#f0f0f0]"
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
