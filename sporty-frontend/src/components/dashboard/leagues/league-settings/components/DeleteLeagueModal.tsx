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
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <h3 className="text-lg font-medium text-foreground">Delete League</h3>
        <p className="mt-2 text-sm text-slate-400">
          Type <span className="font-medium text-foreground">{leagueName}</span>{" "}
          to confirm permanent deletion.
        </p>

        <input
          value={confirmText}
          onChange={(event) => onConfirmTextChange(event.target.value)}
          placeholder="League name"
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-foreground outline-none focus:border-red-400/30 focus:ring-2 focus:ring-red-400/20"
        />

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-foreground hover:bg-white/8"
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
