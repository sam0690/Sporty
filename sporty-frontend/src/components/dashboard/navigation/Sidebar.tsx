"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/context/auth-context";
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
  const { user, logout, actionLoading } = useAuth();

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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-100 bg-white md:block [font-family:system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
      <div className="relative h-full">
        <div className="p-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-xl font-medium tracking-tight text-gray-900 transition-opacity hover:opacity-80">
            <span aria-hidden="true">⚽🏀🏏</span>
            <span>Sporty</span>
          </Link>
        </div>

        <nav className="flex flex-col gap-1 px-3" aria-label="Dashboard Navigation">
          {items.map((item) => {
            const active = isActiveRoute(item.href, pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mx-3 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 p-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleLogout}
              disabled={actionLoading.logout}
              className="inline-flex items-center gap-2 rounded-lg border border-black bg-white px-3 py-2 text-sm text-gray-800 transition-transform duration-150 hover:scale-[1.03] disabled:opacity-50"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenSettings}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-primary-300 hover:text-primary-700"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
