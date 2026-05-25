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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xl">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/95 p-6 text-foreground shadow-[0_28px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
          Account linking required
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-foreground">
          Verify your password to continue
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {email ? (
            <>
              An account already exists with{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Enter your password to confirm ownership before linking Google.
            </>
          ) : (
            "Enter your password to confirm ownership before linking Google."
          )}
        </p>

        <label className="mt-5 block text-left text-sm font-medium text-slate-200">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-foreground outline-none transition focus:border-accent-primary/40 focus:ring-2 focus:ring-accent-primary/20"
            placeholder="Enter your password"
          />
        </label>

        {errorMessage ? (
          <p className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
