"use client";

import { Modal } from "@/components/ui";

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
  const canDelete = confirmText.trim() === leagueName;

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeDisabled={isDeleting}>
      <h3 className="font-barlow-condensed text-xl font-700 uppercase tracking-[2px] text-danger">
        Delete League
      </h3>
      <p className="mt-2 text-sm text-fg-2">
        Type <span className="font-600 text-fg-1">{leagueName}</span> to
        confirm permanent deletion.
      </p>

      <input
        value={confirmText}
        onChange={(event) => onConfirmTextChange(event.target.value)}
        placeholder="League name"
        className="mt-4 w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-danger"
      />

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-[3px] border border-white/8 bg-transparent px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canDelete || isDeleting}
          onClick={onConfirm}
          className="flex-1 rounded-[3px] bg-danger px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-white transition-colors hover:bg-danger/85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? "Deleting..." : "Delete League"}
        </button>
      </div>
    </Modal>
  );
}
