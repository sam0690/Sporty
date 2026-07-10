"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { NotificationBell } from "@/components/dashboard/navigation/NotificationBell";
import { LogoutConfirmationModal } from "@/components/dashboard/navigation/LogoutConfirmationModal";
import { cn } from "@/utils/classUtils";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SidebarProps = {
  items: DashboardNavItem[];
};

function isActiveRoute(href: string, path: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ items }: SidebarProps) {
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

  const handleOpenSettings = () => {
    router.push("/settings");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-[rgba(255,255,255,0.08)] bg-[#0d0d14] md:flex lg:w-64">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-3 py-5 lg:px-6">
        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[3px] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8fb25]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d14] lg:w-auto lg:justify-start"
        >
          <span className="font-bebas text-2xl tracking-[3px] text-[#e8fb25] lg:hidden">
            S
          </span>
          <span className="hidden font-bebas text-2xl tracking-[3px] text-[#e8fb25] lg:inline">
            SPORTY
          </span>
        </Link>
        <NotificationBell className="hidden text-[#555560] transition-colors hover:text-[#f0f0f0] lg:block" />
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
                "group flex items-center justify-center gap-3 rounded-r-[3px] border-l-2 py-3 text-sm transition-all duration-150 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e8fb25]/60 lg:justify-start lg:pl-[10px] lg:pr-3",
                active
                  ? "border-[#e8fb25] bg-[#1d1d26] text-[#f0f0f0]"
                  : "border-transparent text-[#555560] hover:bg-[#1d1d26] hover:text-[#f0f0f0]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-[#e8fb25]" : "text-[#555560] group-hover:text-[#f0f0f0]",
                )}
              />
              <span className="hidden font-barlow-condensed text-xs font-700 uppercase tracking-[2px] lg:inline">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="space-y-2 border-t border-[rgba(255,255,255,0.08)] p-3 lg:p-4">
        <button
          type="button"
          onClick={handleOpenSettings}
          title="Settings"
          className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-3 text-xs font-barlow-condensed font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:border-white/15 hover:text-[#f0f0f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8fb25]/60 lg:justify-start"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline">Settings</span>
        </button>
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          disabled={actionLoading.logout}
          title="Log out"
          className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-3 text-xs font-barlow-condensed font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:border-[#ff3b30]/40 hover:text-[#ff3b30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b30]/50 disabled:opacity-50 lg:justify-start"
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
