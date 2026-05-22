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

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  teamData,
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-surface/90 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <h2 className="text-xl font-semibold text-foreground">
          Confirm Team Creation
        </h2>

        <div className="mt-4 space-y-2 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
          <p>
            <span className="font-medium text-foreground">Team Name:</span>{" "}
            {teamData.teamName}
          </p>
          <p>
            <span className="font-medium text-foreground">League:</span>{" "}
            {teamData.leagueName}
          </p>
          <p>
            <span className="font-medium text-foreground">Players:</span>{" "}
            {teamData.selectedCount}/{teamData.requiredPlayers}
          </p>
          <p>
            <span className="font-medium text-foreground">Total Cost:</span> $
            {teamData.totalCost}
          </p>
          <p>
            <span className="font-medium text-foreground">Remaining:</span> $
            {teamData.remainingBudget}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-foreground hover:bg-white/8"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-4 py-2 font-semibold text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
