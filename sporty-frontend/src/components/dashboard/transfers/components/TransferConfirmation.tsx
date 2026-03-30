"use client";

import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";

type SelectedPlayer = {
  id: number;
  name: string;
  sport: Sport;
  position: string;
  price: number;
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
      <div className="w-full max-w-md rounded-2xl bg-surface-100 p-6 shadow-card">
        <h3 className="text-xl font-semibold text-text-primary">Confirm Transfer</h3>
        <p className="mt-3 text-text-secondary">
          Add {player.name} to your team?
        </p>

        <div className="mt-4 space-y-2 rounded-lg border border-border bg-white p-3 text-sm">
          <p className="font-semibold text-text-primary">{player.name}</p>
          <p className="text-text-secondary">Position: {player.position}</p>
          <p className="text-primary-600">Price: ${player.price}M</p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-primary-500 px-4 py-2 text-primary-500 transition-colors hover:bg-primary-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export type { SelectedPlayer };
