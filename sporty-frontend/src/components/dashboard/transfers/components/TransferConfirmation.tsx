"use client";

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
  // new: whether transfers are currently open; if false, confirm is disabled
  transfersOpen?: boolean;
  // optional deadline (ISO string) for countdown display
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
    let mounted = true;
    const update = () => {
      const deadline = new Date(transferDeadlineAt as string);
      const diff = Math.max(
        0,
        Math.floor((deadline.getTime() - Date.now()) / 1000),
      );
      if (mounted) setSecondsLeft(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
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
          const s = secondsLeft;
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          return `${h > 0 ? `${h}:` : ""}${h > 0 ? String(m).padStart(2, "0") : m}:${String(sec).padStart(2, "0")}`;
        })();

  const confirmDisabled = isLoading || !isValidBatch || !transfersOpen;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-accent/20 bg-white p-8 shadow-strong animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-bold text-black">
          Confirm Staged Transfers
        </h3>

        <p className="mt-4 text-sm text-secondary">
          Out: {stagedOutPlayers.length} | In: {stagedInPlayers.length}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-red-100 bg-danger/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-danger">
              Out
            </p>
            <div className="mt-2 space-y-1">
              {stagedOutPlayers.map((player) => (
                <p
                  key={player.id.toString()}
                  className="truncate text-xs text-black"
                >
                  {player.name}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-green-100 bg-primary/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              In
            </p>
            <div className="mt-2 space-y-1">
              {stagedInPlayers.map((player) => (
                <p
                  key={player.id.toString()}
                  className="truncate text-xs text-black"
                >
                  {player.name}
                </p>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm leading-relaxed text-secondary">
          Confirming will apply all staged transfers at once.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {!transfersOpen && (
            <div className="rounded-md border border-yellow-100 bg-yellow-50 p-3 text-sm text-yellow-800">
              Transfers are closed for this window.
              {formattedCountdown ? (
                <span className="ml-2 font-mono">
                  Closing: {formattedCountdown}
                </span>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="w-full rounded-full bg-primary py-3.5 font-bold text-white transition-all hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-200"
          >
            {isLoading ? "Processing..." : "Confirm Transfers"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full rounded-full py-3 font-semibold text-secondary/60 hover:text-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export type { SelectedPlayer };
