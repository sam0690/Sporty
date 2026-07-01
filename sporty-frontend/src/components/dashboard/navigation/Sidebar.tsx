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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface md:flex md:flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 hover:no-underline"
        >
          <span className="font-condensed text-2xl font-bold uppercase tracking-[0.08em] leading-none text-ink">
            SPOR<span className="text-primary">TY</span>
          </span>
        </Link>
        <NotificationBell className="text-ink-muted transition-colors hover:text-ink" />
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
                "group flex items-center gap-3 rounded-sm py-2.5 pl-[10px] pr-3 text-sm transition-all duration-150 hover:no-underline",
                active
                  ? "border-l-2 border-primary bg-surface-muted text-ink"
                  : "border-l-2 border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-ink-faint group-hover:text-ink",
                )}
              />
              <span className="font-condensed text-sm font-semibold uppercase tracking-[0.1em]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="space-y-2 border-t border-border p-4">
        <button
          type="button"
          onClick={handleOpenSettings}
          className="flex w-full items-center gap-2 rounded-sm border border-border bg-transparent px-3 py-2 font-condensed text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-ink"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          disabled={actionLoading.logout}
          className="flex w-full items-center gap-2 rounded-sm border border-border bg-transparent px-3 py-2 font-condensed text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
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
