import Link from "next/link";
import { cn } from "@/utils/classUtils";
import type { DashboardNavItem } from "@/components/dashboard/main-dashboard/types";

type SidebarProps = {
  items: DashboardNavItem[];
  currentPath: string;
};

function isActiveRoute(href: string, path: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ items, currentPath }: SidebarProps) {
  return (
    <aside className="rounded-xl border border-border-light bg-surface-100 p-4 shadow-card lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          S
        </span>
        <div>
          <p className="text-base font-semibold text-text-primary">Sporty</p>
          <p className="text-xs text-text-secondary">Fantasy Dashboard</p>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col" aria-label="Dashboard Navigation">
        {items.map((item) => {
          const active = isActiveRoute(item.href, currentPath);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-primary-50 text-primary border border-primary-100"
                  : "text-text-secondary hover:bg-secondary-50 hover:text-text-primary",
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
