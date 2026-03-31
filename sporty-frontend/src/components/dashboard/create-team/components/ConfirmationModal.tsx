"use client";

type TeamData = {
  teamName: string;
  leagueName: string;
  selectedCount: number;
  requiredPlayers: number;
  totalCost: number;
  remainingBudget: number;
};

type ConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  teamData: TeamData;
  isLoading?: boolean;
};

export function ConfirmationModal({ isOpen, onClose, onConfirm, teamData, isLoading = false }: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-100 p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-text-primary">Confirm Team Creation</h2>

        <div className="mt-4 space-y-2 rounded-lg border border-border p-4 text-sm text-text-secondary">
          <p><span className="font-medium text-text-primary">Team Name:</span> {teamData.teamName}</p>
          <p><span className="font-medium text-text-primary">League:</span> {teamData.leagueName}</p>
          <p><span className="font-medium text-text-primary">Players:</span> {teamData.selectedCount}/{teamData.requiredPlayers}</p>
          <p><span className="font-medium text-text-primary">Total Cost:</span> ${teamData.totalCost}</p>
          <p><span className="font-medium text-text-primary">Remaining:</span> ${teamData.remainingBudget}</p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-primary-500 px-4 py-2 text-primary-500 hover:bg-primary-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-primary-500 px-4 py-2 font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
