"use client";

import { Home, Shield, Trophy, ArrowRightLeft, UserRound } from "lucide-react";
import { MobileBottomNav } from "@/components/dashboard/navigation/MobileBottomNav";
import { Sidebar, type DashboardNavItem } from "@/components/dashboard/navigation/Sidebar";

type DashboardNavigationProps = {
  children: React.ReactNode;
};

const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Overview", href: "/dashboard", icon: Home },
  { label: "My Team", href: "/my-team", icon: Shield },
  { label: "Leagues", href: "/leagues", icon: Trophy },
  { label: "Transfers", href: "/transfers", icon: ArrowRightLeft },
  { label: "Profile", href: "/profile", icon: UserRound },
];

export function DashboardNavigation({ children }: DashboardNavigationProps) {
  return (
    <div className="min-h-screen bg-gray-50 [font-family:system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
      <Sidebar items={DASHBOARD_NAV_ITEMS} />

      <div className="pb-20 pt-8 md:ml-64 md:pb-8">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">{children}</div>
      </div>

      <MobileBottomNav items={DASHBOARD_NAV_ITEMS} />
    </div>
  );
}
