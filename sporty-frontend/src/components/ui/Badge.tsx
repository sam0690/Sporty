"use client";

import type { ReactNode } from "react";

type BadgeTone = "accent" | "success" | "danger" | "neutral";

type BadgeProps = {
  tone?: BadgeTone;
  /** Overrides `tone` with the sport-specific palette (sport-badge-* utilities). */
  sport?: string;
  size?: "sm" | "default";
  className?: string;
  children: ReactNode;
};

const sportBadgeClass: Record<string, string> = {
  football: "sport-badge-football",
  basketball: "sport-badge-basketball",
  cricket: "sport-badge-cricket",
  rugby: "sport-badge-rugby",
  multisport: "sport-badge-multisport",
};

const toneClass: Record<BadgeTone, string> = {
  accent: "border border-accent/30 bg-accent/12 text-accent",
  success: "border border-success/30 bg-success/10 text-success",
  danger: "border border-danger/30 bg-danger/10 text-danger",
  neutral: "border border-white/12 text-fg-3",
};

export function Badge({
  tone = "neutral",
  sport,
  size = "default",
  className = "",
  children,
}: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const colorClass = sport
    ? (sportBadgeClass[sport] ?? "sport-badge-multisport")
    : toneClass[tone];

  return (
    <span
      className={`inline-flex items-center rounded-[3px] font-sans font-700 uppercase tracking-[1px] ${sizeClass} ${colorClass} ${className}`}
      aria-label={sport}
    >
      {children}
    </span>
  );
}
