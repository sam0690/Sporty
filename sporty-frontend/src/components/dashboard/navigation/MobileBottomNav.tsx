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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-background/95 backdrop-blur-xl md:hidden"
      aria-label="Mobile Dashboard Navigation"
    >
      <div className="flex h-18 items-center justify-around px-2">
        {items.map((item) => {
          const active = isActiveRoute(item.href, pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-transform active:scale-95 hover:no-underline",
                active ? "text-accent-primary" : "text-slate-400",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <span className="absolute -top-1 h-1.5 w-1.5 rounded-full bg-accent-primary shadow-[0_0_16px_rgba(0,229,255,0.8)]" />
              ) : null}
              <Icon
                className={cn(
                  "h-5 w-5",
                  active ? "drop-shadow-[0_0_10px_rgba(0,229,255,0.45)]" : "",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
