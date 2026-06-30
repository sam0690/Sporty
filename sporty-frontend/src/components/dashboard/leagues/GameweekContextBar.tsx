"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import type { TTransferWindow } from "@/types/league";

type GameweekContextBarProps = {
  leagueId: string;
  editableWindow?: TTransferWindow;
  activeWindow?: TTransferWindow;
  // Which deadline drives the "locks in" countdown for this page.
  deadlineField: "lineup_deadline_at" | "transfer_deadline_at";
};

function formatCountdown(targetMs: number, nowMs: number): string {
  const ms = targetMs - nowMs;
  if (ms <= 0) return "now";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function GameweekContextBar({
  leagueId,
  editableWindow,
  activeWindow,
  deadlineField,
}: GameweekContextBarProps) {
  // Refresh the countdown every minute — no per-second timer needed.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = globalThis.setInterval(() => setNow(Date.now()), 60_000);
    return () => globalThis.clearInterval(id);
  }, []);

  if (!editableWindow) {
    return null;
  }

  const deadline = editableWindow[deadlineField];
  const deadlineMs = deadline ? new Date(deadline).getTime() : null;

  // Only contrast against the in-progress gameweek when it's genuinely live
  // (now sits within its window) and is a different gameweek than the one being
  // edited — during setup the in-progress and editable windows can coincide.
  const liveStartMs = activeWindow
    ? new Date(activeWindow.start_at).getTime()
    : null;
  const liveEndMs = activeWindow
    ? new Date(activeWindow.end_at).getTime()
    : null;
  const showLive =
    !!activeWindow &&
    liveStartMs !== null &&
    liveEndMs !== null &&
    now >= liveStartMs &&
    now <= liveEndMs &&
    activeWindow.number !== editableWindow.number;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[3px] border border-[rgba(232,251,37,0.2)] bg-[#111117]">
      <div className="flex items-stretch gap-3">
        <div className="w-1 self-stretch bg-[#e8fb25]" />
        <div className="py-2.5">
          <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-[#e8fb25]">
            Setting up ▸ Gameweek {editableWindow.number}
          </p>
          {deadlineMs ? (
            <p className="mt-0.5 text-xs text-[#555560]">
              Locks in{" "}
              <span className="font-700 tabular-nums text-[#9a9aa5]">
                {formatCountdown(deadlineMs, now)}
              </span>{" "}
              · before its matches start
            </p>
          ) : null}
        </div>
      </div>

      {showLive ? (
        <Link
          href={`/leagues/${leagueId}`}
          className="group flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-[#0d0d12]"
        >
          <span className="inline-flex items-center gap-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#ff3b30]">
            <span className="size-1.5 rounded-full bg-[#ff3b30] animate-live-pulse" />
            GW{activeWindow!.number} is live now
          </span>
          <span className="inline-flex items-center gap-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#555560] group-hover:text-[#9a9aa5]">
            View live
            <ArrowRight size={12} />
          </span>
        </Link>
      ) : null}
    </div>
  );
}
