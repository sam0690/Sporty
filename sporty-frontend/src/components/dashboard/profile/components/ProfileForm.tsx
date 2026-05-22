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
      className="card-fade-in space-y-5 rounded-[1.75rem] border border-white/10 bg-surface/80 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl"
    >
      <div className="space-y-2">
        <label htmlFor="display-name" className="text-sm text-slate-400">
          Display Name
        </label>
        <input
          id="display-name"
          value={form.name}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, name: event.target.value }))
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-foreground outline-none transition-all focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm text-slate-400">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, email: event.target.value }))
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-foreground outline-none transition-all focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          required
          readOnly
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="text-sm text-slate-400">
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
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-foreground outline-none transition-all focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          maxLength={160}
        />
        <p className="text-right text-xs text-slate-500">
          {form.bio.length}/160
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-linear-to-r from-accent-primary via-cyan-400 to-accent-secondary px-6 py-2 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setForm(user)}
          className="rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-accent-primary/20 hover:bg-white/8 hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export type { ProfileUser };
