"use client";

import { useEffect } from "react";
import { LogOut } from "lucide-react";

type LogoutConfirmationModalProps = {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmationModal({
  isOpen,
  isLoading = false,
  onClose,
  onConfirm,
}: LogoutConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6 text-ink shadow-lg">
        <div className="inline-flex rounded-sm bg-danger-soft px-3 py-1">
          <span className="font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-danger">
            Logout Confirmation
          </span>
        </div>

        <h2 className="mt-4 font-condensed text-4xl font-bold uppercase tracking-[0.01em] text-ink">
          Do you want to log out?
        </h2>

        <p className="mt-3 text-sm leading-6 text-ink-muted">
          You&apos;ll be signed out of your account and redirected to the login
          screen. Choose Cancel to stay logged in.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-5 py-2.5 font-condensed text-xs font-semibold uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink hover:bg-surface-muted disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-danger px-5 py-2.5 font-condensed text-xs font-semibold uppercase tracking-[0.1em] text-on-primary transition-colors hover:bg-primary-press disabled:opacity-60 sm:w-auto"
          >
            <LogOut className="h-3.5 w-3.5" />
            {isLoading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
