import Link from "next/link";
import { cn } from "@/utils/classUtils";
import type { NavItem } from "@/components/landing/navbar/types";

type NavLinksProps = {
  items: NavItem[];
  currentPath: string;
  onNavigate?: () => void;
  mobile?: boolean;
};

function isItemActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === "/") {
    return currentPath === "/";
  }

  return currentPath === itemHref || currentPath.startsWith(`${itemHref}/`);
}

export function NavLinks({
  items,
  currentPath,
  onNavigate,
  mobile = false,
}: NavLinksProps) {
  return (
    <nav
      className={cn(
        "flex",
        mobile
          ? "flex-col items-stretch gap-1"
          : "hidden items-center gap-1 md:flex",
      )}
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = isItemActive(item.href, currentPath);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              mobile && "w-full",
              active
                ? "bg-primary-50 text-primary"
                : "text-text-secondary hover:bg-secondary-50 hover:text-primary",
            )}
          >
            {item.icon ? <span>{item.icon}</span> : null}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
