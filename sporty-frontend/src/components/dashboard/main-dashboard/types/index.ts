export type DashboardNavItem = {
  label: string;
  href: string;
};

export type OverviewStat = {
  label: string;
  value: string;
  change: string;
};

export type TeamPlayer = {
  id: number;
  name: string;
  position: string;
  points: number;
};

export type ActivityItem = {
  id: number;
  title: string;
  detail: string;
  time: string;
};
