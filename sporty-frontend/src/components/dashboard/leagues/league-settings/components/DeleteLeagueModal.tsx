"use client";

type DeleteLeagueModalProps = {
  isOpen: boolean;
  leagueName: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteLeagueModal({
  isOpen,
  leagueName,
  confirmText,
  onConfirmTextChange,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteLeagueModalProps) {
  if (!isOpen) {
    return null;
  }

  const canDelete = confirmText.trim() === leagueName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-medium text-black">Delete League</h3>
        <p className="mt-2 text-sm text-secondary">
          Type <span className="font-medium text-black">{leagueName}</span> to confirm permanent deletion.
        </p>

        <input
          value={confirmText}
          onChange={(event) => onConfirmTextChange(event.target.value)}
          placeholder="League name"
          className="mt-4 w-full rounded-md border border-border px-4 py-2.5 text-black outline-none focus:border-red-400"
        />

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border px-4 py-2 text-black hover:bg-[#F4F4F9]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canDelete || isDeleting}
            onClick={onConfirm}
            className="flex-1 rounded-full border border-danger/30 bg-danger/5 px-4 py-2 font-medium text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete League"}
          </button>
        </div>
      </div>
    </div>
  );
}
