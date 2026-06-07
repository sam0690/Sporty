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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(255,255,255,0.08)] bg-[#0d0d14] md:hidden"
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
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors active:scale-95 hover:no-underline",
                active
                  ? "text-[#e8fb25] border-t-2 border-[#e8fb25] -mt-0.5"
                  : "text-[#555560] border-t-2 border-transparent hover:text-[#f0f0f0]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-barlow-condensed font-700 uppercase tracking-[1px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
