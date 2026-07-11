"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Repeat } from "lucide-react";

import type { TTransferWindow } from "@/types/league";

type TransferFieldsProps = {
  leagueId: string;
  isOpen: boolean;
  isLoading?: boolean;
  window?: TTransferWindow;
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

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TransferFields({
  leagueId,
  isOpen,
  isLoading = false,
  window: editableWindow,
}: TransferFieldsProps) {
  // Tick once a minute so the countdown stays fresh without a per-second timer.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = globalThis.setInterval(() => setNow(Date.now()), 60_000);
    return () => globalThis.clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <section className="flex overflow-hidden rounded-[3px] border border-white/8 bg-surface-1">
        <div className="w-1 bg-surface-3" />
        <div className="flex-1 p-4">
          <div className="h-2 w-28 animate-pulse rounded bg-surface-3" />
          <div className="mt-3 h-5 w-44 animate-pulse rounded bg-surface-3" />
        </div>
      </section>
    );
  }

  const accent = isOpen ? "#e2c368" : "#33333a";
  const deadlineMs = editableWindow?.transfer_deadline_at
    ? new Date(editableWindow.transfer_deadline_at).getTime()
    : null;

  return (
    <section className="flex overflow-hidden rounded-[3px] border border-white/8 bg-surface-1">
      <div className="w-1 shrink-0" style={{ background: accent }} />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="section-label">Transfer Window</span>
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-accent">
                <span className="size-1.5 rounded-full bg-accent animate-live-pulse" />
                Open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-fg-3">
                <Lock size={9} /> Locked
              </span>
            )}
          </div>

          {isOpen && editableWindow ? (
            <p className="mt-2 font-barlow-condensed text-lg font-700 uppercase tracking-[0.5px] text-fg-1">
              Gameweek {editableWindow.number} is open to edit
            </p>
          ) : (
            <p className="mt-2 font-barlow-condensed text-lg font-700 uppercase tracking-[0.5px] text-fg-2">
              {editableWindow
                ? `Gameweek ${editableWindow.number} transfers have locked`
                : "No upcoming gameweek to edit"}
            </p>
          )}

          {isOpen && deadlineMs ? (
            <p className="mt-1 text-xs text-fg-3">
              Closes in{" "}
              <span className="font-700 tabular-nums text-fg-2">
                {formatCountdown(deadlineMs, now)}
              </span>{" "}
              · {formatDeadline(editableWindow!.transfer_deadline_at)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-fg-3">
              Make your swaps before the next gameweek starts.
            </p>
          )}
        </div>

        {isOpen ? (
          <Link
            href={`/transfers?leagueId=${leagueId}`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[3px] bg-accent px-5 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
          >
            <Repeat size={14} />
            Make Transfers
            <ArrowRight size={14} />
          </Link>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-[3px] border border-white/8 bg-surface-2 px-5 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-fg-3">
            <Lock size={13} />
            Closed
          </span>
        )}
      </div>
    </section>
  );
}
