"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { useEffect, useState } from "react";
import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";
import type { OwnedPlayer } from "./CurrentRoster";

type SelectedPlayer = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  price: number;
  avgPoints?: number;
  form?: number;
};

type TransferConfirmationProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  allowUnpaired?: boolean;
  stagedOutPlayers?: OwnedPlayer[];
  stagedInPlayers?: SelectedPlayer[];
  transfersOpen?: boolean;
  transferDeadlineAt?: string | null;
};

export function TransferConfirmation({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  allowUnpaired = false,
  stagedOutPlayers = [],
  stagedInPlayers = [],
  transfersOpen = true,
  transferDeadlineAt = null,
}: TransferConfirmationProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!transferDeadlineAt) {
      return;
    }

    const update = () => {
      const deadline = new Date(transferDeadlineAt);
      const diff = Math.max(
        0,
        Math.floor((deadline.getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
    };

    update();
    const id = window.setInterval(update, 1000);

    return () => window.clearInterval(id);
  }, [transferDeadlineAt]);

  if (!isOpen) {
    return null;
  }

  const hasAnyStagedMoves =
    stagedOutPlayers.length > 0 || stagedInPlayers.length > 0;
  const isValidBatch = allowUnpaired
    ? hasAnyStagedMoves
    : stagedOutPlayers.length > 0 &&
      stagedInPlayers.length > 0 &&
      stagedOutPlayers.length === stagedInPlayers.length;

  const formattedCountdown =
    secondsLeft == null
      ? null
      : (() => {
          const totalSeconds = secondsLeft;
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;

          return `${hours > 0 ? `${hours}:` : ""}${hours > 0 ? String(minutes).padStart(2, "0") : minutes}:${String(seconds).padStart(2, "0")}`;
        })();

  const confirmDisabled = isLoading || !isValidBatch || !transfersOpen;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md overflow-hidden card-surface animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h3 className="font-barlow-condensed text-xl font-700 uppercase tracking-[2px] text-fg-1">
            Confirm Transfers
          </h3>
          <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-fg-3">
            {stagedOutPlayers.length} out · {stagedInPlayers.length} in
          </span>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-[3px] border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.06)] p-4">
              <p className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-danger flex items-center gap-1">
                <ChevronDown className="h-3 w-3" /> Out
              </p>
              <div className="mt-2 space-y-1">
                {stagedOutPlayers.length === 0 ? (
                  <p className="text-xs text-fg-3">—</p>
                ) : (
                  stagedOutPlayers.map((player) => (
                    <p
                      key={player.id}
                      className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1"
                    >
                      {player.name}
                    </p>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[3px] border border-success/20 bg-success/06 p-4">
              <p className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-success flex items-center gap-1">
                <ChevronUp className="h-3 w-3" /> In
              </p>
              <div className="mt-2 space-y-1">
                {stagedInPlayers.length === 0 ? (
                  <p className="text-xs text-fg-3">—</p>
                ) : (
                  stagedInPlayers.map((player) => (
                    <p
                      key={player.id}
                      className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1"
                    >
                      {player.name}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>

          {transfersOpen && formattedCountdown ? (
            <p className="mt-5 text-center text-xs text-fg-3">
              Window closes in{" "}
              <span className="font-bebas text-base tracking-[1px] text-accent">
                {formattedCountdown}
              </span>
            </p>
          ) : (
            <p className="mt-5 text-center text-sm text-fg-3">
              Confirming applies all staged transfers at once.
            </p>
          )}

          {!transfersOpen ? (
            <div className="mt-5 rounded-[3px] border border-warning/25 bg-warning/8 px-3 py-2.5 text-sm text-warning">
              Transfers are closed for this window.
              {formattedCountdown ? (
                <span className="ml-2 font-bebas tracking-[1px]">
                  {formattedCountdown}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="w-full rounded-[3px] bg-accent py-3 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Processing…" : "Confirm Transfers"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full rounded-[3px] border border-white/8 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { SelectedPlayer };
