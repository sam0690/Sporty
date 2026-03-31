"use client";

import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type SelectedPlayer = {
  id: number;
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
};

export function TransferConfirmation({
  isOpen,
  onClose,
  player,
  onConfirm,
}: TransferConfirmationProps) {
  if (!isOpen || !player) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
        <h3 className="text-xl font-medium text-gray-900">Confirm Transfer</h3>
        <p className="mt-3 text-gray-500">
          Add {player.name} to your team?
        </p>

        <div className="mt-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
          <p className="font-medium text-gray-900">{player.name}</p>
          <p className="text-gray-500">Position: {player.position}</p>
          <p className="text-gray-900">Price: ${player.price}M</p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-[#1e6785] bg-[#247BA0] px-4 py-2 text-white transition-colors hover:bg-[#1e6785]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export type { SelectedPlayer };
