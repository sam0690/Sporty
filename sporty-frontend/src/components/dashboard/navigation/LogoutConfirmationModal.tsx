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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-[3px] border border-white/8 bg-surface-1 p-6 text-fg-1">
        <div className="inline-flex rounded-[3px] border border-accent/25 bg-[#1a1a10] px-3 py-1">
          <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-accent-dim">
            Logout Confirmation
          </span>
        </div>

        <h2 className="mt-4 font-bebas text-4xl uppercase tracking-[2px] text-fg-1">
          Do you want to log out?
        </h2>

        <p className="mt-3 text-sm leading-6 text-fg-3">
          You&apos;ll be signed out of your account and redirected to the login
          screen. Choose Cancel to stay logged in.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full rounded-[3px] border border-white/8 bg-transparent px-5 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:border-white/15 hover:text-fg-1 disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#ff3b30] px-5 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-white transition-colors hover:bg-[#ff5548] disabled:opacity-60 sm:w-auto"
          >
            <LogOut className="h-3.5 w-3.5" />
            {isLoading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
