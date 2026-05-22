"use client";

import { useMemo } from "react";
import { Home, Shield, Trophy, ArrowRightLeft, UserRound } from "lucide-react";
import { MobileBottomNav } from "@/components/dashboard/navigation/MobileBottomNav";
import {
  Sidebar,
  type DashboardNavItem,
} from "@/components/dashboard/navigation/Sidebar";
import { useMe } from "@/hooks/auth/useMe";

type DashboardNavigationProps = {
  children: React.ReactNode;
};

export function DashboardNavigation({ children }: DashboardNavigationProps) {
  const { data: me } = useMe();
  const userId = me?.id ?? "1";

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
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Sidebar items={navItems} />

      <div className="pb-24 pt-8 md:ml-64 md:pb-10 md:pt-10">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">{children}</div>
      </div>

      <MobileBottomNav items={navItems} />
    </div>
  );
}
