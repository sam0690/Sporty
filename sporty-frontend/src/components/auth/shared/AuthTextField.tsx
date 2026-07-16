"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

// The single source of the auth-form field vocabulary: every input on the
// login / signup / forgot / reset forms renders through this so the label
// treatment, surface, focus ring, icon slot and password reveal stay
// identical across the whole flow.

const FIELD_BASE =
  "h-11 w-full rounded-[3px] border border-white/12 bg-surface-2 px-4 text-sm text-fg-1 placeholder:text-fg-3 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";

type AuthTextFieldProps = {
  id: string;
  label: string;
  /** Leading icon, e.g. <Mail />. Sized by the slot. */
  icon?: ReactNode;
  error?: string;
  /** Password visibility toggle. `subject` refines the aria-label. */
  reveal?: { shown: boolean; onToggle: () => void; subject?: string };
  /** Everything for the <input>: type, placeholder, autoComplete, value/
   *  onChange or a react-hook-form register(...) spread. */
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  /** Rendered under the field (e.g. PasswordStrengthIndicator). */
  children?: ReactNode;
};

export function AuthTextField({
  id,
  label,
  icon,
  error,
  reveal,
  inputProps,
  children,
}: AuthTextFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-sans text-xs font-700 uppercase tracking-[2px] text-fg-2"
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3 [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        )}
        <input
          id={id}
          {...inputProps}
          className={`${FIELD_BASE}${icon ? " pl-10" : ""}${reveal ? " pr-12" : ""}`}
        />
        {reveal && (
          <button
            type="button"
            onClick={reveal.onToggle}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-3 transition-colors hover:text-accent"
            aria-label={`${reveal.shown ? "Hide" : "Show"} ${reveal.subject ?? "password"}`}
          >
            {reveal.shown ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      {children}
    </div>
  );
}

// Shared in-button loading spinner so every submit button waits identically.
export function ButtonSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-0/30 border-t-surface-0" />
      {label}
    </span>
  );
}
