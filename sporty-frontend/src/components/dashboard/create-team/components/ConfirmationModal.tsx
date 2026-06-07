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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 ">
      <div className="w-full max-w-md rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6  ">
        <h2 className="text-xl font-600 text-[#f0f0f0]">
          Confirm Team Creation
        </h2>

        <div className="mt-4 space-y-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-sm text-[#555560]">
          <p>
            <span className="font-medium text-[#f0f0f0]">Team Name:</span>{" "}
            {teamData.teamName}
          </p>
          <p>
            <span className="font-medium text-[#f0f0f0]">League:</span>{" "}
            {teamData.leagueName}
          </p>
          <p>
            <span className="font-medium text-[#f0f0f0]">Players:</span>{" "}
            {teamData.selectedCount}/{teamData.requiredPlayers}
          </p>
          <p>
            <span className="font-medium text-[#f0f0f0]">Total Cost:</span> $
            {teamData.totalCost}
          </p>
          <p>
            <span className="font-medium text-[#f0f0f0]">Remaining:</span> $
            {teamData.remainingBudget}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-[#f0f0f0] hover:bg-[#1d1d26]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-[3px] bg-linear-to-r [#e8fb25] px-4 py-2 font-600 text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
