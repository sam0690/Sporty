"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styling on the confirm button (destructive actions). Default true. */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Require the user to type an exact string before Confirm is enabled. */
  confirmInput?: { expectedValue: string; placeholder?: string };
  /** Extra business-rule gate on top of loading/confirmInput (e.g. role checks). */
  confirmDisabled?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  onConfirm,
  onClose,
  confirmInput,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState("");

  // Clear the confirm-input on close (adjust-state-during-render, per
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setTypedValue("");
    }
  }

  const canConfirm =
    !confirmDisabled &&
    (confirmInput ? typedValue.trim() === confirmInput.expectedValue : true);

  return (
    <Modal isOpen={open} onClose={onClose} closeDisabled={loading} title={title}>
      <h3
        className={`font-sans text-xl font-700 uppercase tracking-[2px] ${
          danger ? "text-danger" : "text-fg-1"
        }`}
      >
        {title}
      </h3>
      <div className="mt-2 text-sm text-fg-2">{message}</div>

      {confirmInput && (
        <input
          value={typedValue}
          onChange={(event) => setTypedValue(event.target.value)}
          placeholder={confirmInput.placeholder}
          className="mt-4 w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-danger focus-visible:ring-2 focus-visible:ring-danger/50"
        />
      )}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 rounded-[3px] border border-white/8 bg-transparent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:text-fg-1 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || loading}
          className={`flex-1 rounded-[3px] px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            danger ? "bg-danger hover:bg-danger/85" : "bg-accent hover:bg-accent-bright"
          }`}
        >
          {loading ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
