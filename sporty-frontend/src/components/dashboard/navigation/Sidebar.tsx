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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[rgba(255,255,255,0.08)] bg-[#0d0d14] md:flex md:flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-6 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 hover:no-underline"
        >
          <span className="font-bebas text-2xl tracking-[3px] text-[#e8fb25]">
            SPORTY
          </span>
        </Link>
        <NotificationBell className="text-[#555560] transition-colors hover:text-[#f0f0f0]" />
      </div>

      {/* Nav items */}
      <nav
        className="flex flex-1 flex-col gap-0.5 px-3 pt-4"
        aria-label="Dashboard Navigation"
      >
        {items.map((item) => {
          const active = isActiveRoute(item.href, pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 hover:no-underline",
                active
                  ? "border-l-2 border-[#e8fb25] bg-[#1d1d26] text-[#f0f0f0] pl-[10px]"
                  : "border-l-2 border-transparent text-[#555560] hover:bg-[#1d1d26] hover:text-[#f0f0f0] pl-[10px]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-[#e8fb25]" : "text-[#555560] group-hover:text-[#f0f0f0]",
                )}
              />
              <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-[rgba(255,255,255,0.08)] p-4 space-y-2">
        <button
          type="button"
          onClick={handleOpenSettings}
          className="flex w-full items-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-2 text-xs font-barlow-condensed font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:border-white/15 hover:text-[#f0f0f0]"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          disabled={actionLoading.logout}
          className="flex w-full items-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-2 text-xs font-barlow-condensed font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:border-[#ff3b30]/40 hover:text-[#ff3b30] disabled:opacity-50"
          aria-label="Log out"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
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
