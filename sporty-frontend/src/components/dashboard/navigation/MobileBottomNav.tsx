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
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface md:hidden"
      aria-label="Mobile Dashboard Navigation"
    >
      <div className="flex h-16 items-stretch">
        {items.map((item) => {
          const active = isActiveRoute(item.href, pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors hover:no-underline active:scale-95",
                active
                  ? "-mt-0.5 border-t-2 border-primary text-primary"
                  : "border-t-2 border-transparent text-ink-muted hover:text-ink",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span className="font-condensed text-[11px] font-semibold uppercase tracking-[0.08em]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
