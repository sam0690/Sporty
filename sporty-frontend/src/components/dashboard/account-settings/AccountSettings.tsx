"use client";

import { useState } from "react";
import Link from "next/link";

import {
  PreferencesForm,
  type Preferences,
} from "@/components/dashboard/profile/components/PreferencesForm";
import { PasswordForm } from "@/components/dashboard/profile/components/PasswordForm";
import { UserService } from "@/services/UserService";
import { toastifier } from "@/lib/toastifier";

const defaultPreferences: Preferences = {
  emailNotifications: true,
  pushNotifications: false,
  darkMode: true,
  language: "en",
};

export function AccountSettings() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  const handleUpdatePreferences = (next: Preferences): void => {
    setPreferences(next);
    toastifier.info("Preferences updated");
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> => {
    if (!currentPassword || !newPassword) {
      toastifier.error("Please complete all password fields");
      return false;
    }
    try {
      await UserService.changePassword(currentPassword, newPassword);
      return true;
    } catch {
      toastifier.error("Unable to update password");
      return false;
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-6 py-8 text-[#0B1220]">
      <header className="border-b border-[rgba(11,18,32,0.08)] pb-6">
        <p className="section-label">Account</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#0B1220] sm:text-6xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Notifications, language and security
        </p>
      </header>

      <div className="mt-6 space-y-6">
        <PreferencesForm
          preferences={preferences}
          onUpdate={handleUpdatePreferences}
        />

        <PasswordForm onChangePassword={handleChangePassword} />

        {/* Identity (avatar, name, bio, delete account) lives on the profile page. */}
        <Link
          href="/profile"
          className="flex items-center justify-between gap-4 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-5 py-4 transition-colors hover:border-[rgba(220,38,38,0.2)] hover:no-underline"
        >
          <div>
            <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#0B1220]">
              Profile &amp; Account
            </p>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              Edit your avatar, display name and bio, or delete your account
            </p>
          </div>
          <span className="shrink-0 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#DC2626]">
            Open →
          </span>
        </Link>
      </div>
    </section>
  );
}
