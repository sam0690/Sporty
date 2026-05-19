import type {
  ActivityItem,
  DashboardNavItem,
  OverviewStat,
  TeamPlayer,
} from "@/components/dashboard/main-dashboard/types";

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "My Team", href: "/my-team" },
  { label: "Leagues", href: "/leagues" },
  { label: "Transfers", href: "/transfers" },
  { label: "Profile", href: "/profile" },
];

export const OVERVIEW_STATS: OverviewStat[] = [
  { label: "Total Points", value: "1,428", change: "+42 this week" },
  { label: "Rank", value: "#2,105", change: "Up 115 places" },
  { label: "Budget", value: "$101.4M", change: "$0.6M in bank" },
  { label: "Gameweek Points", value: "78", change: "Above avg +14" },
];

export const TEAM_PREVIEW_PLAYERS: TeamPlayer[] = [
  { id: "1", name: "Ederson", position: "GK", points: 6 },
  { id: "2", name: "Saliba", position: "DEF", points: 7 },
  { id: "3", name: "Trent", position: "DEF", points: 5 },
  { id: "4", name: "Saka", position: "MID", points: 11 },
  { id: "5", name: "Palmer", position: "MID", points: 8 },
  { id: "6", name: "Haaland", position: "FWD", points: 12 },
];

export const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: "1",
    type: "points",
    title: "Match Updated",
    detail: "Manchester City vs Arsenal final points confirmed.",
    timestamp: "2 hours ago",
  },
  {
    id: "2",
    type: "transfer",
    title: "Transfer Success",
    detail: "You swapped Watkins for Haaland.",
    timestamp: "Yesterday",
  },
  {
    id: "3",
    type: "rank",
    title: "League Position",
    detail: "You climbed to 3rd in Premier League Champions.",
    timestamp: "2 days ago",
  },
];