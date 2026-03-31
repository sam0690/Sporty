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
    <form onSubmit={handleSave} className="card-fade-in space-y-5 rounded-2xl border border-gray-100 bg-white p-6">
      <div className="space-y-2">
        <label htmlFor="display-name" className="text-sm text-gray-600">
          Display Name
        </label>
        <input
          id="display-name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm text-gray-600">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          required
          readOnly
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="text-sm text-gray-600">
          Bio
        </label>
        <textarea
          id="bio"
          rows={3}
          value={form.bio}
          onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value.slice(0, 160) }))}
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          maxLength={160}
        />
        <p className="text-right text-xs text-gray-400">{form.bio.length}/160</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-primary-600 px-6 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setForm(user)}
          className="rounded-lg border border-gray-300 px-6 py-2 text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export type { ProfileUser };
