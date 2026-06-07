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
    <section className="card-fade-in rounded-[1.75rem] border border-red-500/20 bg-red-500/10 p-6">
      <div>
        <h2 className="text-md font-600 text-red-300">Delete Account</h2>
        <p className="mt-2 text-sm text-[#555560]">
          Once you delete your account, there is no going back. All your data
          will be permanently removed.
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-[3px] border border-red-400/20 bg-red-500/10 px-5 py-2 text-red-200 transition-colors hover:bg-red-500/20"
        >
          Delete Account
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 ">
          <div className="w-full max-w-md rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6  ">
            <h3 className="text-lg font-600 text-[#f0f0f0]">
              Delete Account?
            </h3>
            <p className="mt-2 text-sm text-[#555560]">
              This action cannot be undone. Type "DELETE" to confirm.
            </p>

            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="Type DELETE"
              className="mt-4 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-[#f0f0f0] outline-none focus:border-red-400/30 focus:border-[#e8fb25]"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                }}
                className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-[#f0f0f0] transition-colors hover:bg-[#1d1d26] hover:text-[#f0f0f0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || isDeleting}
                className="rounded-[3px] bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-400 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
