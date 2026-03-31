"use client";

import { useMemo, useState } from "react";
import { toastifier } from "@/libs/toastifier";

type PasswordFormProps = {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
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
      ? "text-green-600"
      : strength === "Medium"
        ? "text-amber-600"
        : "text-red-600";

  return (
    <section className="mt-6 border-t border-border pt-6">
      <h2 className="mb-4 text-xl font-semibold text-text-primary">Change Password</h2>

      <form onSubmit={submit} className="grid grid-cols-1 gap-5">
        <div className="space-y-2">
          <label htmlFor="current-password" className="text-sm font-medium text-text-primary">
            Current Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="current-password"
              type={show.current ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShow((prev) => ({ ...prev, current: !prev.current }))}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary"
            >
              {show.current ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium text-text-primary">
            New Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-password"
              type={show.new ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShow((prev) => ({ ...prev, new: !prev.new }))}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary"
            >
              {show.new ? "Hide" : "Show"}
            </button>
          </div>
          <p className={`text-xs ${strengthColor}`}>Strength: {strength}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-sm font-medium text-text-primary">
            Confirm New Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="confirm-password"
              type={show.confirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShow((prev) => ({ ...prev, confirm: !prev.confirm }))}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary"
            >
              {show.confirm ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-primary-500 px-6 py-2 text-white transition-colors hover:bg-primary-600 disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}
