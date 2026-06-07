"use client";

import { useEffect, useState } from "react";
import { toastifier } from "@/lib/toastifier";

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
    <form
      onSubmit={handleSave}
      className="card-fade-in space-y-5 rounded-[1.75rem] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6 "
    >
      <div className="space-y-2">
        <label htmlFor="display-name" className="text-sm text-[#555560]">
          Display Name
        </label>
        <input
          id="display-name"
          value={form.name}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, name: event.target.value }))
          }
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none transition-all focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm text-[#555560]">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, email: event.target.value }))
          }
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none transition-all focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          required
          readOnly
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="text-sm text-[#555560]">
          Bio
        </label>
        <textarea
          id="bio"
          rows={3}
          value={form.bio}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              bio: event.target.value.slice(0, 160),
            }))
          }
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none transition-all focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          maxLength={160}
        />
        <p className="text-right text-xs text-[#555560]">
          {form.bio.length}/160
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-[3px] bg-linear-to-r [#e8fb25] px-6 py-2 text-sm font-600 text-background transition-all hover:brightness-110 disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setForm(user)}
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-6 py-2 text-sm font-600 text-[#f0f0f0] transition-colors hover:border-[rgba(232,251,37,0.2)] hover:bg-[#1d1d26] hover:text-[#f0f0f0]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export type { ProfileUser };
