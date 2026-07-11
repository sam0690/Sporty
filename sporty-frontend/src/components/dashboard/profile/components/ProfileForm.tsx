"use client";

import { useState } from "react";
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

  // Re-seed the form when the saved user changes (adjust-state-during-render,
  // per https://react.dev/learn/you-might-not-need-an-effect).
  const [prevUser, setPrevUser] = useState(user);
  if (prevUser !== user) {
    setPrevUser(user);
    setForm(user);
  }

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

  const fieldLabel =
    "mb-2 block font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-fg-2";
  const fieldInput =
    "w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-accent";

  return (
    <form
      onSubmit={handleSave}
      className="card-fade-in overflow-hidden rounded-[3px] border border-white/8 bg-surface-1"
    >
      <header className="border-b border-white/8 px-5 py-3">
        <p className="section-label">Personal Info</p>
      </header>

      <div className="space-y-5 p-5">
        <div>
          <label htmlFor="display-name" className={fieldLabel}>
            Display Name
          </label>
          <input
            id="display-name"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            className={fieldInput}
            required
          />
        </div>

        <div>
          <label htmlFor="email" className={fieldLabel}>
            Email
            <span className="ml-2 text-fg-3">(read-only)</span>
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
            className={`${fieldInput} cursor-not-allowed text-fg-2`}
            required
            readOnly
          />
        </div>

        <div>
          <label htmlFor="bio" className={fieldLabel}>
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
            className={fieldInput}
            maxLength={160}
          />
          <p className="mt-1 text-right text-xs text-fg-3">
            {form.bio.length}/160
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-[3px] bg-accent px-6 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>

          <button
            type="button"
            onClick={() => setForm(user)}
            className="rounded-[3px] border border-white/8 bg-surface-3 px-6 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export type { ProfileUser };
