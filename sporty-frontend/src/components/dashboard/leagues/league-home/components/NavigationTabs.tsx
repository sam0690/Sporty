"use client";

import Link from "next/link";

import { useLeague } from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";

type TabKey =
  | "overview"
  | "lineup"
  | "gameweek"
  | "leaderboard"
  | "free-agents"
  | "waivers"
  | "trades"
  | "chat"
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
  { key: "free-agents", label: "Free Agents" },
  { key: "waivers", label: "Waivers" },
  { key: "trades", label: "Trades" },
  { key: "chat", label: "Chat" },
  { key: "members", label: "Members" },
  { key: "invite", label: "Invite" },
  { key: "settings", label: "Settings" },
];

export function NavigationTabs({
  activeTab,
  leagueId,
  isCommissioner = false,
}: NavigationTabsProps) {
  const { data: league } = useLeague(leagueId);
  const { isDraftMode } = useLeagueCompetitionMode(league);

  const routes: Record<TabKey, string> = {
    overview:      `/leagues/${leagueId}`,
    lineup:        `/leagues/${leagueId}/lineup`,
    gameweek:      `/leagues/${leagueId}/gameweek`,
    leaderboard:   `/leagues/${leagueId}/leaderboard`,
    "free-agents": `/leagues/${leagueId}/free-agents`,
    waivers:       `/leagues/${leagueId}/waivers`,
    trades:        `/leagues/${leagueId}/trades`,
    chat:          `/leagues/${leagueId}/chat`,
    members:       `/leagues/${leagueId}/members`,
    invite:        `/leagues/${leagueId}/invite`,
    settings:      `/leagues/${leagueId}/settings`,
  };

  return (
    <nav
      className="mb-6 overflow-x-auto rounded-[3px] border border-white/8 bg-surface-1 p-1"
      aria-label="League Navigation Tabs"
    >
      <div className="flex min-w-max gap-1">
        {tabs
          .filter((tab) => tab.key !== "settings" || isCommissioner)
          .filter(
            (tab) =>
              !["free-agents", "waivers", "trades"].includes(tab.key) ||
              isDraftMode,
          )
          .map((tab) => {
            const isActive = tab.key === activeTab;

            return (
              <Link
                key={tab.key}
                href={routes[tab.key]}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-[3px] px-4 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] transition-colors hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  isActive
                    ? "bg-accent text-surface-0"
                    : "bg-transparent text-fg-3 hover:bg-surface-3 hover:text-fg-1"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
      </div>
    </nav>
  );
}

export type { TabKey };
