"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { NotificationBell } from "@/components/dashboard/navigation/NotificationBell";
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

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      router.push("/login");
    }
  };

  const handleOpenSettings = () => {
    router.push("/profile");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-gradient-to-b from-[#060816] via-[#050816] to-[#03040a] font-sans md:block">
      <div className="relative flex h-full flex-col overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,229,255,0.14),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(255,61,129,0.10),_transparent_34%)]" />
        <div className="relative z-10 border-b border-white/10 p-6">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-[0.18em] text-foreground transition-opacity hover:opacity-80 hover:no-underline"
            >
              <span aria-hidden="true" className="text-accent-primary">
                ●
              </span>
              <span>Sporty</span>
            </Link>
            <NotificationBell className="text-slate-300 transition-colors hover:text-foreground" />
          </div>
        </div>

        <nav
          className="relative z-10 flex flex-1 flex-col gap-1 px-3 pt-4"
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
                  "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:no-underline",
                  active
                    ? "border border-accent-primary/30 bg-white/8 text-foreground shadow-[0_0_24px_rgba(0,229,255,0.14)]"
                    : "border border-transparent text-slate-300 hover:border-white/8 hover:bg-white/6 hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active
                      ? "text-accent-primary"
                      : "text-slate-400 group-hover:text-accent-primary",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="relative z-10 border-t border-white/10 p-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleLogout}
              disabled={actionLoading.logout}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition-all duration-200 hover:border-accent-secondary/30 hover:bg-accent-secondary/10 hover:text-foreground disabled:opacity-50"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenSettings}
            className="mt-3 flex w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition-all duration-200 hover:border-accent-primary/30 hover:bg-accent-primary/10 hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
