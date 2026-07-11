"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

type GoogleAccountLinkModalProps = {
  isOpen: boolean;
  email?: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  errorMessage?: string;
};

export function GoogleAccountLinkModal(props: GoogleAccountLinkModalProps) {
  // Mount the content only while open so the password state resets on close.
  if (!props.isOpen) {
    return null;
  }
  return <GoogleAccountLinkModalContent {...props} />;
}

function GoogleAccountLinkModalContent({
  email,
  isLoading = false,
  onClose,
  onConfirm,
  errorMessage,
}: GoogleAccountLinkModalProps) {
  const [password, setPassword] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 ">
      <div className="w-full max-w-md rounded-[3px] border border-white/8 bg-surface-1 p-6 text-fg-1  ">
        <div className="inline-flex rounded-[3px] border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-600 uppercase tracking-[0.18em] text-cyan-200">
          Account linking required
        </div>
        <h2 className="mt-4 text-2xl font-600 text-fg-1">
          Verify your password to continue
        </h2>
        <p className="mt-3 text-sm leading-6 text-fg-1">
          {email ? (
            <>
              An account already exists with{" "}
              <span className="font-medium text-fg-1">{email}</span>.
              Enter your password to confirm ownership before linking Google.
            </>
          ) : (
            "Enter your password to confirm ownership before linking Google."
          )}
        </p>

        <label className="mt-5 block text-left text-sm text-fg-1">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-[3px] border border-white/8 bg-surface-3 px-4 py-3 text-fg-1 outline-none transition focus:border-accent/40 focus:border-accent"
            placeholder="Enter your password"
          />
        </label>

        {errorMessage ? (
          <p className="mt-3 rounded-[3px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
