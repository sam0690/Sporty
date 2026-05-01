import Link from "next/link";
import { cn } from "@/utils/classUtils";
import type { DashboardNavItem } from "@/components/dashboard/main-dashboard/types";

type SidebarProps = {
  items: DashboardNavItem[];
  currentPath: string;
  onLogout: () => void;
  isLoggingOut?: boolean;
};

function isActiveRoute(href: string, path: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({
  items,
  currentPath,
  onLogout,
  isLoggingOut,
}: SidebarProps) {
  return (
    <aside className="flex h-full flex-col rounded-lg border border-accent/20 bg-white p-4 shadow-card lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-[#F4F4F9] font-bold">
          S
        </span>
        <div>
          <p className="font-display text-base font-bold text-black">Sporty</p>
          <p className="text-xs text-secondary">Fantasy Dashboard</p>
        </div>
      </div>

      <nav
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col"
        aria-label="Dashboard Navigation"
      >
        {items.map((item) => {
          const active = isActiveRoute(item.href, currentPath);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200",
                active
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-secondary hover:bg-accent/20 hover:text-black",
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm font-medium text-black transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}
