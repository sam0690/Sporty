"use client";

import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";
import type { OwnedPlayer } from "./CurrentRoster";

type SelectedPlayer = {
  id: any;
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
};

export function TransferConfirmation({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  allowUnpaired = false,
  stagedOutPlayers = [],
  stagedInPlayers = [],
}: TransferConfirmationProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-bold text-gray-900">
          Confirm Staged Transfers
        </h3>

        <p className="mt-4 text-sm text-gray-600">
          Out: {stagedOutPlayers.length} | In: {stagedInPlayers.length}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
              Out
            </p>
            <div className="mt-2 space-y-1">
              {stagedOutPlayers.map((player) => (
                <p key={player.id} className="truncate text-xs text-gray-700">
                  {player.name}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">
              In
            </p>
            <div className="mt-2 space-y-1">
              {stagedInPlayers.map((player) => (
                <p key={player.id} className="truncate text-xs text-gray-700">
                  {player.name}
                </p>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm leading-relaxed text-gray-500">
          Confirming will apply all staged transfers at once.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || !isValidBatch}
            className="w-full rounded-full bg-primary-600 py-3.5 font-bold text-white transition-all hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-200"
          >
            {isLoading ? "Processing..." : "Confirm Transfers"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full rounded-full py-3 font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export type { SelectedPlayer };
