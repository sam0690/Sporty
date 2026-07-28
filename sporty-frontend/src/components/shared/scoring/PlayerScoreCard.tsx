"use client";

import { memo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { TScoreEvent } from "@/types/player";
import { FantasyPointsBadge } from "./FantasyPointsBadge";
import { LivePointsIndicator } from "./LivePointsIndicator";
import { ScoreEventList } from "./ScoreEventList";
import { BonusPointsChip } from "./BonusPointsChip";

type PlayerScoreCardProps = {
  name: string;
  position: string;
  points: number;
  breakdown?: TScoreEvent[] | null;
  status?: string | null;        // "LIVE" | "FT" | "90'" | null
  form?: number[];               // recent gameweek points, oldest→newest
  bonus?: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  live?: boolean;                // use the animated live counter
  className?: string;
};

const POS_TONE: Record<string, string> = {
  GKP: "text-[#f0a742] border-[#f0a742]/30 bg-[#f0a742]/10",
  DEF: "text-[#4aa8ff] border-[#4aa8ff]/30 bg-[#4aa8ff]/10",
  MID: "text-[#34d399] border-[#34d399]/30 bg-[#34d399]/10",
  FWD: "text-danger border-danger/30 bg-danger/10",
};

// Compact form dots: green/amber/grey by relative points.
function FormDots({ form }: { form: number[] }) {
  if (!form?.length) return null;
  return (
    <span className="flex items-center gap-0.5" aria-label="Recent form">
      {form.slice(-5).map((p, i) => (
        <span
          key={i}
          className={`size-1.5 rounded-full ${
            p >= 6 ? "bg-[#34d399]" : p >= 3 ? "bg-accent/70" : "bg-white/20"
          }`}
        />
      ))}
    </span>
  );
}

// Squad / match-centre player card (Tasks 4 & 5): position icon, points (live
// counter when live), status, form, captain badge, and an expandable
// breakdown. Sport-agnostic — position tone falls back to neutral.
function PlayerScoreCardBase({
  name, position, points, breakdown, status, form, bonus = 0,
  isCaptain = false, isViceCaptain = false, live = false, className = "",
}: PlayerScoreCardProps) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = !!breakdown && breakdown.length > 0;

  return (
    <div className={`rounded-[3px] border border-white/8 bg-surface-1 ${className}`}>
      <button
        type="button"
        onClick={() => hasBreakdown && setOpen((v) => !v)}
        disabled={!hasBreakdown}
        aria-expanded={hasBreakdown ? open : undefined}
        className="flex w-full items-center gap-3 p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
      >
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-[3px] border text-[10px] font-700 tracking-[0.5px] ${
            POS_TONE[position] ?? "text-fg-3 border-white/10 bg-white/5"
          }`}
        >
          {position}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-sans text-sm font-600 text-fg-1">{name}</span>
            {isCaptain && (
              <span className="rounded-[2px] bg-accent px-1 text-[10px] font-700 text-surface-0" title="Captain">C</span>
            )}
            {isViceCaptain && !isCaptain && (
              <span className="rounded-[2px] border border-accent/40 px-1 text-[10px] font-700 text-accent" title="Vice-captain">V</span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-3">
            {status && <span>{status}</span>}
            {form && form.length > 0 && <FormDots form={form} />}
            <BonusPointsChip bonus={bonus} />
          </span>
        </span>
        {live ? (
          <LivePointsIndicator points={points} size="md" />
        ) : (
          <FantasyPointsBadge points={points} size="md" />
        )}
        {hasBreakdown && (
          <ChevronDown
            className={`size-4 shrink-0 text-fg-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        )}
      </button>
      {hasBreakdown && open && (
        <div className="border-t border-white/6 px-3 py-3">
          <ScoreEventList events={breakdown} compact />
        </div>
      )}
    </div>
  );
}

export const PlayerScoreCard = memo(PlayerScoreCardBase);
