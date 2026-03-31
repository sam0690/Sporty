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
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          "fixed inset-0 z-40 transition-opacity duration-200",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onToggle} />
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-[82%] max-w-sm bg-white p-5 shadow-xl transition-transform duration-300",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="space-y-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
