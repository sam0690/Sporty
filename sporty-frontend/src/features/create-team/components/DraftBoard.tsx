"use client";

import { ArrowRight, ArrowLeft } from "lucide-react";
import { PlayerAvatar } from "@/components/ui";
import type { TMembership } from "@/types/league";

type DraftBoardProps = {
  members: TMembership[];
  currentTurnUserId: string | null;
  roundNumber: number;
  pickNumber: number;
};

export function DraftBoard({
  members,
  currentTurnUserId,
  roundNumber,
  pickNumber,
}: DraftBoardProps) {
  const ordered = [...members]
    .filter((m) => m.status === "active" && m.draft_position != null)
    .sort((a, b) => (a.draft_position ?? 0) - (b.draft_position ?? 0));

  if (ordered.length === 0) {
    return null;
  }

  // Standard snake draft: odd rounds pick in draft-position order, even
  // rounds reverse — shown only as a direction hint, not a predicted pick
  // order (only `currentTurnUserId`, the backend's own answer, is
  // authoritative for who's actually on the clock).
  const ascending = roundNumber % 2 === 1;

  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="section-label">
          Round {roundNumber} · Pick {pickNumber}
        </p>
        <span className="flex items-center gap-1.5 text-[10px] font-700 uppercase tracking-[1.5px] text-fg-3">
          Draft order
          {ascending ? (
            <ArrowRight className="size-3" aria-hidden />
          ) : (
            <ArrowLeft className="size-3" aria-hidden />
          )}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {ordered.map((member) => {
          const isOnTheClock = member.user.id === currentTurnUserId;
          return (
            <div
              key={member.id}
              className={`flex shrink-0 flex-col items-center gap-1.5 rounded-[3px] border px-3 py-2.5 transition-colors ${
                isOnTheClock
                  ? "border-accent/50 bg-accent/8"
                  : "border-white/8 bg-surface-2"
              }`}
            >
              <div className="relative">
                <PlayerAvatar name={member.user.username} size="sm" />
                {isOnTheClock ? (
                  <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-accent ring-2 ring-surface-1" />
                ) : null}
              </div>
              <span className="max-w-16 truncate font-sans text-[10px] font-700 uppercase tracking-[0.5px] text-fg-2">
                {member.user.username}
              </span>
              {isOnTheClock ? (
                <span className="text-[9px] font-700 uppercase tracking-[1px] text-accent">
                  On the clock
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
