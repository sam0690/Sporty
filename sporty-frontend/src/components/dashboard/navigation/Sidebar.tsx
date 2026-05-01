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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-black font-sans md:block">
      <div className="relative h-full">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight text-[#F4F4F9] transition-opacity hover:opacity-80 hover:no-underline"
            >
              <span aria-hidden="true">⚽🏀🏏</span>
              <span>Sporty</span>
            </Link>
            <NotificationBell className="text-[#F4F4F9]/70 hover:text-[#F4F4F9]" />
          </div>
        </div>

        <nav
          className="flex flex-col gap-1 px-3 pt-4"
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
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:no-underline",
                  active
                    ? "bg-primary text-white font-semibold"
                    : "text-[#F4F4F9]/70 hover:bg-white/10 hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleLogout}
              disabled={actionLoading.logout}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-[#F4F4F9]/70 transition-all duration-200 hover:bg-white/10 hover:text-white disabled:opacity-50"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenSettings}
            className="mt-3 flex w-full items-center gap-2 rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-[#F4F4F9]/70 transition-all duration-200 hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
