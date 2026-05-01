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
      ? "bg-primary/50"
      : strength === "Medium"
        ? "bg-amber-500"
        : "bg-danger/50";

  const strengthWidth =
    strength === "Strong"
      ? "100%"
      : strength === "Medium"
        ? "66%"
        : "33%";

  return (
    <section className="card-fade-in space-y-4 rounded-lg border border-accent/20 bg-white p-6">
      <h2 className="text-md font-medium text-black">Change Password</h2>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="current-password" className="text-sm text-secondary">
            Current Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="current-password"
              type={show.current ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShow((prev) => ({ ...prev, current: !prev.current }))}
              className="rounded-lg border border-border px-3 py-2 text-sm text-secondary"
            >
              {show.current ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm text-secondary">
            New Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-password"
              type={show.new ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShow((prev) => ({ ...prev, new: !prev.new }))}
              className="rounded-lg border border-border px-3 py-2 text-sm text-secondary"
            >
              {show.new ? "Hide" : "Show"}
            </button>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/30">
              <div className={`h-full ${strengthColor} transition-all duration-200`} style={{ width: strengthWidth }} />
            </div>
            <p className="text-xs text-secondary">Strength: {strength}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-sm text-secondary">
            Confirm New Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="confirm-password"
              type={show.confirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShow((prev) => ({ ...prev, confirm: !prev.confirm }))}
              className="rounded-lg border border-border px-3 py-2 text-sm text-secondary"
            >
              {show.confirm ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg border border-border px-6 py-2 text-black transition-colors hover:bg-[#F4F4F9] disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Update Password"}
          </button>
        </div>
      </form>
    </section>
  );
}
