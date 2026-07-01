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
    <aside className="flex h-full flex-col rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4  lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[3px] bg-accent-primary text-black font-bold">
          S
        </span>
        <div>
          <p className="font-barlow-condensed text-base font-bold text-[#0B1220]">
            Sporty
          </p>
          <p className="text-xs text-[#6B7280]">Fantasy Dashboard</p>
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
                "rounded-[3px] px-3 py-2.5 text-sm whitespace-nowrap transition-all duration-200",
                active
                  ? "border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
                  : "text-[#6B7280] hover:bg-[#F3F4F7] hover:text-[#0B1220]",
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
          className="w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-3 py-2.5 text-sm text-[#0B1220] transition-colors hover:bg-[#F3F4F7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}
