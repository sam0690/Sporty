"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/classUtils";
import type { DashboardNavItem } from "@/components/dashboard/navigation/Sidebar";

type MobileBottomNavProps = {
  items: DashboardNavItem[];
};

function isActiveRoute(href: string, path: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-[70px] border-t border-gray-100 bg-white/90 backdrop-blur-sm md:hidden" aria-label="Mobile Dashboard Navigation">
      <div className="flex h-full items-center justify-around px-2">
        {items.map((item) => {
          const active = isActiveRoute(item.href, pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-w-0 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-transform active:scale-95",
                active ? "text-primary-600" : "text-gray-400",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? <span className="absolute -top-1 h-1 w-1 rounded-full bg-primary-600" /> : null}
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
