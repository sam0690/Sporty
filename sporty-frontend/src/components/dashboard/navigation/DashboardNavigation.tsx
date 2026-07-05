"use client";

import { useMemo } from "react";
import {
  Home,
  Shield,
  Trophy,
  ArrowRightLeft,
  UserRound,
  CalendarDays,
  Lock,
  LifeBuoy,
} from "lucide-react";
import { MobileBottomNav } from "@/components/dashboard/navigation/MobileBottomNav";
import {
  Sidebar,
  type DashboardNavItem,
} from "@/components/dashboard/navigation/Sidebar";
import { useMe } from "@/hooks/auth/useMe";
import { isAdminRole } from "@/lib/roles";

type DashboardNavigationProps = {
  children: React.ReactNode;
};

export function DashboardNavigation({ children }: DashboardNavigationProps) {
  const { data: me } = useMe();
  const userId = me?.id ?? "1";

  const navItems = useMemo<DashboardNavItem[]>(() => {
    const isAdmin = isAdminRole(me?.role);

    return [
      // Pure admin/ops accounts don't play — these are noise pointing at
      // empty states for them, so skip for any admin-tier role.
      ...(isAdmin
        ? []
        : [
            { label: "Overview", href: "/dashboard", icon: Home },
            { label: "My Team", href: "/my-team", icon: Shield },
            { label: "Leagues", href: "/leagues", icon: Trophy },
            { label: "Transfers", href: "/transfers", icon: ArrowRightLeft },
          ]),
      { label: "Matches", href: "/matches", icon: CalendarDays },
      { label: "Profile", href: `/user/${userId}`, icon: UserRound },
      { label: "Support", href: "/support", icon: LifeBuoy },
      ...(isAdmin ? [{ label: "Admin", href: "/admin", icon: Lock }] : []),
    ];
  }, [userId, me?.role]);

  return (
    <div className="min-h-screen bg-background font-sans text-[#f0f0f0]">
      <Sidebar items={navItems} />

      <div className="pb-24 pt-8 md:ml-64 md:pb-10 md:pt-10">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">{children}</div>
      </div>

      <MobileBottomNav items={navItems} />
    </div>
  );
}
