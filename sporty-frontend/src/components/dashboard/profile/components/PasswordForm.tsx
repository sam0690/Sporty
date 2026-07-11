"use client";

import { useMemo, useState } from "react";
import { toastifier } from "@/lib/toastifier";

type PasswordFormProps = {
  onChangePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<boolean>;
};

type PasswordKey = "current" | "new" | "confirm";

function getStrengthLabel(password: string): "Weak" | "Medium" | "Strong" {
  if (password.length < 6) {
    return "Weak";
  }

  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[^a-zA-Z0-9]/.test(password);

  const score = [hasLetters, hasNumbers, hasSymbols].filter(Boolean).length;
  if (score >= 3 && password.length >= 8) {
    return "Strong";
  }

  return score >= 2 ? "Medium" : "Weak";
}

export function PasswordForm({ onChangePassword }: PasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState<Record<PasswordKey, boolean>>({
    current: false,
    new: false,
    confirm: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const strength = useMemo(() => getStrengthLabel(newPassword), [newPassword]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentPassword.trim()) {
      toastifier.error("Current password is required.");
      return;
    }

    if (newPassword.length < 6) {
      toastifier.error("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toastifier.error("New password and confirmation do not match.");
      return;
    }

    setIsSaving(true);
    const success = await onChangePassword(currentPassword, newPassword);
    setIsSaving(false);

    if (success) {
      toastifier.success("✓ Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const strengthColor =
    strength === "Strong"
      ? "#00e07f"
      : strength === "Medium"
        ? "#ffd86b"
        : "#ff3b5c";

  const strengthWidth =
    strength === "Strong" ? "100%" : strength === "Medium" ? "66%" : "33%";

  const fieldLabel =
    "mb-2 block font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2";
  const fieldInput =
    "w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-accent";
  const toggleBtn =
    "shrink-0 rounded-[3px] border border-white/8 bg-surface-3 px-3 py-2.5 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:text-fg-1";

  return (
    <section className="card-fade-in overflow-hidden card-surface">
      <header className="border-b border-white/8 px-5 py-3">
        <p className="section-label">Security</p>
      </header>

      <form onSubmit={submit} className="space-y-5 p-5">
        <div>
          <label htmlFor="current-password" className={fieldLabel}>
            Current Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="current-password"
              type={show.current ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={fieldInput}
            />
            <button
              type="button"
              onClick={() =>
                setShow((prev) => ({ ...prev, current: !prev.current }))
              }
              className={toggleBtn}
            >
              {show.current ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="new-password" className={fieldLabel}>
            New Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-password"
              type={show.new ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={fieldInput}
            />
            <button
              type="button"
              onClick={() => setShow((prev) => ({ ...prev, new: !prev.new }))}
              className={toggleBtn}
            >
              {show.new ? "Hide" : "Show"}
            </button>
          </div>
          {newPassword ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: strengthWidth, background: strengthColor }}
                />
              </div>
              <p
                className="font-sans text-[10px] font-700 uppercase tracking-[1.5px]"
                style={{ color: strengthColor }}
              >
                {strength}
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <label htmlFor="confirm-password" className={fieldLabel}>
            Confirm New Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="confirm-password"
              type={show.confirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={fieldInput}
            />
            <button
              type="button"
              onClick={() =>
                setShow((prev) => ({ ...prev, confirm: !prev.confirm }))
              }
              className={toggleBtn}
            >
              {show.confirm ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-[3px] bg-accent px-6 py-2.5 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Update Password"}
        </button>
      </form>
    </section>
  );
}
