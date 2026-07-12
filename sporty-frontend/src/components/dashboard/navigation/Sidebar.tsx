"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { NotificationBell } from "@/components/dashboard/navigation/NotificationBell";
import { LogoutConfirmationModal } from "@/components/dashboard/navigation/LogoutConfirmationModal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { isActiveRoute } from "@/lib/route.utils";
import { cn } from "@/utils/classUtils";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SidebarProps = {
  items: DashboardNavItem[];
  userId: string;
  userName?: string;
  avatarUrl?: string | null;
};

export function Sidebar({ items, userId, userName, avatarUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, actionLoading } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      router.push("/login");
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-white/8 bg-surface-2 md:flex lg:w-64">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-5 lg:px-6">
        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[3px] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2 lg:w-auto lg:justify-start"
        >
          <span className="font-display text-2xl tracking-[-0.02em] text-accent lg:hidden">
            S
          </span>
          <span className="hidden font-display text-2xl tracking-[-0.02em] text-accent lg:inline">
            SPORTY
          </span>
        </Link>
        <NotificationBell className="hidden text-fg-3 transition-colors hover:text-fg-1 lg:inline-flex" />
      </div>

      {/* Nav items */}
      <nav
        className="flex flex-1 flex-col gap-1 px-3 pt-4"
        aria-label="Dashboard Navigation"
      >
        {items.map((item) => {
          const active = isActiveRoute(item.href, pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group flex items-center justify-center gap-3 rounded-r-[3px] border-l-2 py-3 text-sm transition-all duration-150 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 lg:justify-start lg:pl-[10px] lg:pr-3",
                active
                  ? "border-accent bg-surface-3 text-fg-1"
                  : "border-transparent text-fg-3 hover:bg-surface-3 hover:text-fg-1",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-accent" : "text-fg-3 group-hover:text-fg-1",
                )}
              />
              <span className="hidden font-sans text-xs font-700 uppercase tracking-[2px] lg:inline">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="space-y-2 border-t border-white/8 p-3 lg:p-4">
        <Link
          href={`/user/${userId}`}
          title={userName ? `View ${userName}'s profile` : "View profile"}
          className="flex items-center justify-center gap-2 rounded-[3px] px-1 py-2 hover:no-underline lg:justify-start"
        >
          <PlayerAvatar name={userName || "Sporty User"} photoUrl={avatarUrl} size="sm" />
          <span className="hidden truncate font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-1 lg:inline">
            {userName || "Sporty User"}
          </span>
        </Link>
        <Link
          href="/profile"
          title="Settings"
          className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/8 bg-transparent px-3 py-3 text-xs font-sans font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:border-white/15 hover:text-fg-1 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 lg:justify-start"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline">Settings</span>
        </Link>
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          disabled={actionLoading.logout}
          title="Log out"
          className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/8 bg-transparent px-3 py-3 text-xs font-sans font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 disabled:opacity-50 lg:justify-start"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline">Log out</span>
        </button>
      </div>

      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        isLoading={actionLoading.logout}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </aside>
  );
}
