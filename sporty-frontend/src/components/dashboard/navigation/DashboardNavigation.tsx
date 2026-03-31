"use client";

import { useMemo } from "react";
import { Home, Shield, Trophy, ArrowRightLeft, UserRound } from "lucide-react";
import { MobileBottomNav } from "@/components/dashboard/navigation/MobileBottomNav";
import { Sidebar, type DashboardNavItem } from "@/components/dashboard/navigation/Sidebar";
import { useAuth } from "@/context/auth-context";

type DashboardNavigationProps = {
  children: React.ReactNode;
};

export function DashboardNavigation({ children }: DashboardNavigationProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "1";

  const navItems = useMemo<DashboardNavItem[]>(
    () => [
      { label: "Overview", href: "/dashboard", icon: Home },
      { label: "My Team", href: "/my-team", icon: Shield },
      { label: "Leagues", href: "/leagues", icon: Trophy },
      { label: "Transfers", href: "/transfers", icon: ArrowRightLeft },
      { label: "Profile", href: `/user/${userId}`, icon: UserRound },
    ],
    [userId],
  );

  return (
    <div className="min-h-screen bg-gray-50 [font-family:system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
      <Sidebar items={navItems} />

      <div className="pb-20 pt-8 md:ml-64 md:pb-8">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">{children}</div>
      </div>

      <MobileBottomNav items={navItems} />
    </div>
  );
}
