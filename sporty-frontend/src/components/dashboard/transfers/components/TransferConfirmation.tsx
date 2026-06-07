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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4  animate-in fade-in">
      <div className="w-full max-w-md rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-8   animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-700 text-[#f0f0f0]">
          Confirm Staged Transfers
        </h3>

        <p className="mt-4 text-sm text-[#555560]">
          Out: {stagedOutPlayers.length} | In: {stagedInPlayers.length}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-[3px] border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-[10px] font-700 uppercase tracking-wider text-red-300">
              Out
            </p>
            <div className="mt-2 space-y-1">
              {stagedOutPlayers.map((player) => (
                <p key={player.id} className="truncate text-xs text-[#f0f0f0]">
                  {player.name}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-[3px] border border-emerald-400/20 bg-emerald-400/10 p-4">
            <p className="text-[10px] font-700 uppercase tracking-wider text-emerald-300">
              In
            </p>
            <div className="mt-2 space-y-1">
              {stagedInPlayers.map((player) => (
                <p key={player.id} className="truncate text-xs text-[#f0f0f0]">
                  {player.name}
                </p>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm leading-relaxed text-[#555560]">
          Confirming will apply all staged transfers at once.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {!transfersOpen ? (
            <div className="rounded-[3px] border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">
              Transfers are closed for this window.
              {formattedCountdown ? (
                <span className="ml-2 font-mono">
                  Closing: {formattedCountdown}
                </span>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="w-full rounded-[3px] bg-linear-to-r [#e8fb25] py-3.5 font-700 text-background  transition-all hover:brightness-110 disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Confirm Transfers"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] py-3 font-600 text-[#555560] transition-colors hover:text-[#f0f0f0]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export type { SelectedPlayer };
