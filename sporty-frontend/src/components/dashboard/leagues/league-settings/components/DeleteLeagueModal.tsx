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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[#FFFFFF] p-6 text-[#0B1220]">
        <h3 className="font-barlow-condensed text-xl font-bold uppercase tracking-[2px] text-[#DC2626]">
          Delete League
        </h3>
        <p className="mt-2 text-sm text-[#6B7280]">
          Type <span className="font-semibold text-[#0B1220]">{leagueName}</span> to
          confirm permanent deletion.
        </p>

        <input
          value={confirmText}
          onChange={(event) => onConfirmTextChange(event.target.value)}
          placeholder="League name"
          className="mt-4 w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-2.5 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]"
        />

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canDelete || isDeleting}
            onClick={onConfirm}
            className="flex-1 rounded-[3px] bg-[#DC2626] px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-white transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete League"}
          </button>
        </div>
      </div>
    </div>
  );
}
