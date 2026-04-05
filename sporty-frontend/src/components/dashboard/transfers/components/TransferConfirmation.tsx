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
  player: SelectedPlayer | null;
  onConfirm: () => void;
  isLoading?: boolean;
  selectedOutPlayer?: OwnedPlayer | null;
};

export function TransferConfirmation({
  isOpen,
  onClose,
  player,
  onConfirm,
  isLoading,
  selectedOutPlayer,
}: TransferConfirmationProps) {
  if (!isOpen || !player) {
    return null;
  }

  const isSwap = !!selectedOutPlayer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-bold text-gray-900">Confirm Transfer</h3>

        {isSwap ? (
          <div className="mt-6 flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Out</p>
              <p className="font-semibold text-gray-900">{selectedOutPlayer.name}</p>
              <p className="text-xs text-gray-500">${selectedOutPlayer.price}M • {selectedOutPlayer.position}</p>
            </div>
            <div className="flex justify-center -my-2 relative z-10">
              <div className="bg-white p-2 rounded-full border border-gray-100 shadow-sm text-primary-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-green-50 border border-green-100">
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">In</p>
              <p className="font-semibold text-gray-900">{player.name}</p>
              <p className="text-xs text-gray-500">${player.price}M • {player.position}</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 p-5 rounded-2xl bg-primary-50 border border-primary-100">
            <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">Signing</p>
            <p className="font-semibold text-gray-900">{player.name}</p>
            <p className="text-xs text-gray-500">${player.price}M • {player.position}</p>
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500 leading-relaxed text-center">
          {isSwap
            ? "Confirming this will swap these players in your squad immediately."
            : `Are you sure you want to add ${player.name} to your roster?`}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || (isSwap && !selectedOutPlayer)}
            className="w-full rounded-full bg-primary-600 py-3.5 font-bold text-white transition-all hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-200"
          >
            {isLoading ? "Processing..." : isSwap ? "Confirm Swap" : "Confirm Signing"}
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
