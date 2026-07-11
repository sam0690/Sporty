"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui";

type DangerZoneProps = {
  onDeleteAccount: () => Promise<boolean>;
};

export function DangerZone({ onDeleteAccount }: DangerZoneProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await onDeleteAccount();
    setIsDeleting(false);

    if (success) {
      setOpen(false);
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

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Delete Account?"
        message={
          <>
            This action cannot be undone. Type{" "}
            <span className="font-600 text-fg-1">DELETE</span> to confirm.
          </>
        }
        confirmLabel={isDeleting ? "Deleting…" : "Delete Account"}
        confirmInput={{ expectedValue: "DELETE", placeholder: "Type DELETE" }}
      />
    </section>
  );
}
