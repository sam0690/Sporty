import { cn } from "@/utils/classUtils";
import type { ReactNode } from "react";

type MobileMenuProps = {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function MobileMenu({ open, onToggle, children }: MobileMenuProps) {
  return (
    <div className="md:hidden">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-surface-200 text-surface-700 transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        onClick={onToggle}
      >
        <span className="sr-only">Toggle navigation</span>
        <svg
          viewBox="0 0 24 24"
          className={cn("h-5 w-5", open && "hidden")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          className={cn("h-5 w-5", !open && "hidden")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div
        id="mobile-nav-menu"
        className={cn(
          "grid overflow-hidden transition-all duration-200",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-3 space-y-3 rounded-lg border border-surface-200 bg-surface px-3 py-3 shadow-dropdown">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
