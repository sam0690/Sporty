"use client";

import type { TTransferWindow } from "@/types/league";

type GameweekEntryNoticeProps = {
  activeWindow: TTransferWindow | undefined;
  editableWindow: TTransferWindow | undefined;
};

function formatWindowDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Lineup deadlines lock a window the moment it starts (by design — so no one
// edits a lineup while its gameweek is already being played). A team created
// after that deadline can't join the in-progress gameweek at all; its first
// scoring window is the next editable one. Surface that explicitly so a zero
// score on the current gameweek doesn't look like broken scoring.
export function GameweekEntryNotice({
  activeWindow,
  editableWindow,
}: GameweekEntryNoticeProps) {
  if (!activeWindow || !editableWindow) return null;
  if (activeWindow.number === editableWindow.number) return null;

  return (
    <div className="rounded-[3px] border border-accent/30 bg-accent/8 px-4 py-3 text-sm text-fg-1">
      <span className="font-sans font-700 uppercase tracking-[1px] text-accent">
        Gameweek {activeWindow.number} is already locked and in progress.
      </span>{" "}
      Your team&apos;s scoring starts from Gameweek {editableWindow.number}{" "}
      (opens {formatWindowDate(editableWindow.start_at)}) — it won&apos;t
      score any points for Gameweek {activeWindow.number}.
    </div>
  );
}
