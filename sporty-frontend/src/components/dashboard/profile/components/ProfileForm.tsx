"use client";

import { useEffect, useState } from "react";
import { toastifier } from "@/libs/toastifier";

type ProfileUser = {
  name: string;
  email: string;
  bio: string;
};

type ProfileFormProps = {
  user: ProfileUser;
  onUpdate: (nextUser: ProfileUser) => Promise<boolean>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileForm({ user, onUpdate }: ProfileFormProps) {
  const [form, setForm] = useState(user);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(user);
  }, [user]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toastifier.error("Display name is required.");
      return;
    }

    if (!EMAIL_REGEX.test(form.email.trim())) {
      toastifier.error("Please enter a valid email address.");
      return;
    }

    setIsSaving(true);
    const success = await onUpdate({
      name: form.name.trim(),
      email: form.email.trim(),
      bio: form.bio.trim().slice(0, 160),
    });
    setIsSaving(false);

    if (success) {
      toastifier.success("✓ Profile updated successfully");
    }
  };

  return (
    <form onSubmit={handleSave} className="grid grid-cols-1 gap-5">
      <div className="space-y-2">
        <label htmlFor="display-name" className="text-sm font-medium text-text-primary">
          Display Name
        </label>
        <input
          id="display-name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-text-primary">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="text-sm font-medium text-text-primary">
          Bio
        </label>
        <textarea
          id="bio"
          value={form.bio}
          onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value.slice(0, 160) }))}
          className="min-h-[80px] w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          maxLength={160}
        />
        <p className="text-right text-xs text-text-secondary">{form.bio.length}/160</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-primary-500 px-6 py-2 text-white transition-colors hover:bg-primary-600 disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setForm(user)}
          className="rounded-lg border border-primary-500 px-6 py-2 text-primary-500 transition-colors hover:bg-primary-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export type { ProfileUser };
