"use client";

import { memo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { TScoreEvent } from "@/types/player";
import { FantasyPointsBadge } from "./FantasyPointsBadge";
import { ScoreEventList } from "./ScoreEventList";

type FantasyPointsBreakdownProps = {
  total: number;
  events: TScoreEvent[];
  title?: string;
  /** Start collapsed (mobile / dense lists). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
};

// "Fantasy Points (N)" header + the colour-coded event list. Optionally
// collapsible for mobile / long squads. Sport-agnostic.
function FantasyPointsBreakdownBase({
  total,
  events,
  title = "Fantasy Points",
  collapsible = false,
  defaultOpen = true,
  className = "",
}: FantasyPointsBreakdownProps) {
  const [open, setOpen] = useState(defaultOpen);

  const header = (
    <div className="flex items-center justify-between gap-3">
      <span className="section-label">{title}</span>
      <div className="flex items-center gap-2">
        <FantasyPointsBadge points={total} size="md" />
        {collapsible && (
          <ChevronDown
            className={`size-4 text-fg-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        )}
      </div>
    </div>
  );

  return (
    <section className={`rounded-[3px] border border-white/8 bg-surface-1 p-4 ${className}`}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-expanded={open}
        >
          {header}
        </button>
      ) : (
        header
      )}
      {(!collapsible || open) && (
        <div className="mt-3">
          <ScoreEventList events={events} />
        </div>
      )}
    </section>
  );
}

export const FantasyPointsBreakdown = memo(FantasyPointsBreakdownBase);
