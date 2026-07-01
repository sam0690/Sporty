"use client";

import { useState } from "react";

type DangerZoneProps = {
  onDeleteAccount: () => Promise<boolean>;
};

export function DangerZone({ onDeleteAccount }: DangerZoneProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmText === "DELETE";

  const handleDelete = async () => {
    if (!canDelete) {
      return;
    }

    setIsDeleting(true);
    const success = await onDeleteAccount();
    setIsDeleting(false);

    if (success) {
      setOpen(false);
      setConfirmText("");
    }
  };

  return (
    <section className="card-fade-in overflow-hidden rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[#FFFFFF]">
      <header className="border-b border-[rgba(255,59,48,0.25)] px-5 py-3">
        <p className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[0.2em] text-[#DC2626]">
          Danger Zone
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="text-sm text-[#6B7280]">
          Deleting your account is permanent — all your data will be removed and
          cannot be recovered.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-transparent px-5 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#DC2626] transition-colors hover:bg-[rgba(255,59,48,0.1)]"
        >
          Delete Account
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[#FFFFFF] p-6">
            <h3 className="font-barlow-condensed text-xl font-bold uppercase tracking-[2px] text-[#DC2626]">
              Delete Account?
            </h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              This action cannot be undone. Type{" "}
              <span className="font-semibold text-[#0B1220]">DELETE</span> to confirm.
            </p>

            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="Type DELETE"
              className="mt-4 w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-2.5 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]"
            />

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                }}
                className="flex-1 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || isDeleting}
                className="flex-1 rounded-[3px] bg-[#DC2626] px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-white transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting…" : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
