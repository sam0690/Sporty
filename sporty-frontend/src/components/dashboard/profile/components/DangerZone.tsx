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
    <section className="card-fade-in rounded-2xl border border-red-100 bg-red-50/30 p-6">
      <div>
        <h2 className="text-md font-medium text-red-600">Delete Account</h2>
        <p className="mt-2 text-sm text-gray-600">
          Once you delete your account, there is no going back. All your data will be permanently removed.
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg border border-red-300 px-5 py-2 text-red-600 transition-colors hover:bg-red-50"
        >
          Delete Account
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-medium text-gray-900">Delete Account?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This action cannot be undone. Type "DELETE" to confirm.
            </p>

            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="Type DELETE"
              className="mt-4 w-full rounded-lg border border-gray-200 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-60"
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
