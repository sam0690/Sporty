"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";

type DangerZoneProps = {
  onDeleteAccount: () => Promise<boolean>;
};

export function DangerZone({ onDeleteAccount }: DangerZoneProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmText === "DELETE";

  const closeModal = () => {
    setOpen(false);
    setConfirmText("");
  };

  const handleDelete = async () => {
    if (!canDelete) {
      return;
    }

    setIsDeleting(true);
    const success = await onDeleteAccount();
    setIsDeleting(false);

    if (success) {
      closeModal();
    }
  };

  return (
    <section className="card-fade-in overflow-hidden rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-surface-1">
      <header className="border-b border-[rgba(255,59,48,0.25)] px-5 py-3">
        <p className="font-sans text-[10px] font-700 uppercase tracking-[0.2em] text-danger">
          Danger Zone
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="text-sm text-fg-2">
          Deleting your account is permanent — all your data will be removed and
          cannot be recovered.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-transparent px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-danger transition-colors hover:bg-[rgba(255,59,48,0.1)]"
        >
          Delete Account
        </button>
      </div>

      <Modal isOpen={open} onClose={closeModal} closeDisabled={isDeleting}>
        <h3 className="font-sans text-xl font-700 uppercase tracking-[2px] text-danger">
          Delete Account?
        </h3>
        <p className="mt-2 text-sm text-fg-2">
          This action cannot be undone. Type{" "}
          <span className="font-600 text-fg-1">DELETE</span> to confirm.
        </p>

        <input
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="Type DELETE"
          className="mt-4 w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-danger"
        />

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="flex-1 rounded-[3px] border border-white/8 bg-transparent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
            className="flex-1 rounded-[3px] bg-danger px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-white transition-colors hover:bg-danger/85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting…" : "Delete Account"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
