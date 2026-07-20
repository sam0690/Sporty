"use client";

import { useMemo } from "react";
import {
  Home,
  Shield,
  Trophy,
  Users,
  CalendarDays,
  Target,
  Lock,
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
            { label: "Home", href: "/dashboard", icon: Home },
            { label: "Leagues", href: "/leagues", icon: Trophy },
            { label: "My Team", href: "/my-team", icon: Shield },
            { label: "Fixtures", href: "/fixtures", icon: CalendarDays },
            { label: "Predictor", href: "/predictions", icon: Target },
            { label: "Players", href: "/players", icon: Users },
          ]),
      ...(isAdmin ? [{ label: "Admin", href: "/admin", icon: Lock }] : []),
    ];
  }, [me?.role]);

  return (
    <div className="min-h-screen bg-background font-sans text-fg-1">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-[3px] focus-visible:bg-accent focus-visible:px-4 focus-visible:py-2 focus-visible:font-sans focus-visible:text-xs focus-visible:font-700 focus-visible:uppercase focus-visible:tracking-[1.5px] focus-visible:text-surface-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
      >
        Skip to content
      </a>

      <Sidebar
        items={navItems}
        userId={userId}
        userName={me?.username}
        avatarUrl={me?.avatar_url}
      />

      <div className="pb-24 pt-8 md:ml-[72px] md:pb-10 md:pt-10 lg:ml-64">
        <main id="main-content" className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <MobileBottomNav items={navItems} />
    </div>
  );
}
