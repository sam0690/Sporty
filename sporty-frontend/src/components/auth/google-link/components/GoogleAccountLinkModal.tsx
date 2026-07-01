"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type GoogleAccountLinkModalProps = {
  isOpen: boolean;
  email?: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  errorMessage?: string;
};

export function GoogleAccountLinkModal({
  isOpen,
  email,
  isLoading = false,
  onClose,
  onConfirm,
  errorMessage,
}: GoogleAccountLinkModalProps) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPassword("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-ink shadow-lg">
        <div className="inline-flex rounded-sm bg-info-soft px-3 py-1 font-condensed text-xs font-semibold uppercase tracking-[0.16em] text-info">
          Account linking required
        </div>
        <h2 className="mt-4 font-condensed text-2xl font-bold uppercase tracking-[0.01em] text-ink">
          Verify your password to continue
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          {email ? (
            <>
              An account already exists with{" "}
              <span className="font-medium text-ink">{email}</span>.
              Enter your password to confirm ownership before linking Google.
            </>
          ) : (
            "Enter your password to confirm ownership before linking Google."
          )}
        </p>

        <label className="mt-5 block text-left font-condensed text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="Enter your password"
          />
        </label>

        {errorMessage ? (
          <p className="mt-3 rounded-md border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => onConfirm(password)}
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? "Verifying..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
