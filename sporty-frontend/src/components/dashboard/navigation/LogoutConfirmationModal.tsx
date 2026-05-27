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
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xl"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-surface/95 p-6 text-foreground shadow-[0_28px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
          Logout confirmation
        </div>

        <h2 className="mt-4 text-2xl font-semibold text-foreground">
          Do you want to log out?
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          You&apos;ll be signed out of your account and redirected to the login
          screen. Choose Cancel to stay logged in.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-2.5 font-semibold text-slate-300 transition-colors hover:bg-white/8 hover:text-foreground disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-rose-500 via-red-500 to-orange-500 px-5 py-2.5 font-semibold text-white shadow-[0_16px_40px_rgba(244,63,94,0.22)] transition-all hover:brightness-110 disabled:opacity-60 sm:w-auto"
          >
            <LogOut className="h-4 w-4" />
            {isLoading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
