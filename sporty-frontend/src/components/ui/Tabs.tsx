"use client";

import { useRef } from "react";
import Link from "next/link";

type TabItem = {
  key: string;
  label: string;
  /** Present → renders as a Link (route-driven tabs). Absent → button (local state). */
  href?: string;
  hidden?: boolean;
};

type TabsProps = {
  items: TabItem[];
  /** Active tab key. */
  value: string;
  /** Required for button-mode (no href); ignored for Link-mode tabs. */
  onChange?: (key: string) => void;
  ariaLabel: string;
  className?: string;
  /** Smaller, secondary-row styling (used for sub-tab groups). */
  size?: "default" | "sm";
  /** Softer active style (surface tint instead of solid accent fill) for sub-tab rows. */
  subtle?: boolean;
};

export function Tabs({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
  size = "default",
  subtle = false,
}: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const visibleItems = items.filter((item) => !item.hidden);

  const focusTabAt = (index: number) => {
    const el = listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[
      index
    ];
    el?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTabAt((index + 1) % visibleItems.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTabAt((index - 1 + visibleItems.length) % visibleItems.length);
    }
  };

  const sizeClass =
    size === "sm"
      ? "min-h-9 px-3 text-[11px] tracking-[1.5px]"
      : "min-h-11 px-4 text-xs tracking-[2px]";

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`flex min-w-max gap-1 ${className}`}
    >
      {visibleItems.map((item, index) => {
        const isActive = item.key === value;
        const activeClass = subtle
          ? "bg-surface-3 text-accent"
          : "bg-accent text-surface-0";
        const itemClassName = `flex items-center rounded-[3px] font-sans font-700 uppercase transition-colors hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${sizeClass} ${
          isActive
            ? activeClass
            : "bg-transparent text-fg-3 hover:bg-surface-3 hover:text-fg-1"
        }`;

        return item.href ? (
          <Link
            key={item.key}
            href={item.href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={itemClassName}
          >
            {item.label}
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onClick={() => onChange?.(item.key)}
            className={itemClassName}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export type { TabItem };
