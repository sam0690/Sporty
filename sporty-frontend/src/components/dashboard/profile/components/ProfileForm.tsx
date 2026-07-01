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
      toastifier.success("Profile updated successfully");
    }
  };

  const fieldLabel =
    "mb-2 block font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280]";
  const fieldInput =
    "w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-2.5 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]";

  return (
    <form
      onSubmit={handleSave}
      className="card-fade-in overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]"
    >
      <header className="border-b border-[rgba(11,18,32,0.08)] px-5 py-3">
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
            <span className="ml-2 text-[#6B7280]">(read-only)</span>
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
            className={`${fieldInput} cursor-not-allowed text-[#6B7280]`}
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
          <p className="mt-1 text-right text-xs text-[#6B7280]">
            {form.bio.length}/160
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-[3px] bg-[#DC2626] px-6 py-2.5 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>

          <button
            type="button"
            onClick={() => setForm(user)}
            className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-6 py-2.5 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export type { ProfileUser };
