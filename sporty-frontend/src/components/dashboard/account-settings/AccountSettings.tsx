"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  PreferencesForm,
  type Preferences,
} from "@/components/dashboard/profile/components/PreferencesForm";
// import { PasswordForm } from "@/components/dashboard/profile/components/PasswordForm";
import { useMe } from "@/hooks/auth/useMe";
import { useUpdateUser } from "@/hooks/users/useUsers";
// import { UserService } from "@/services/UserService";
// import { toastifier } from "@/lib/toastifier";

export function AccountSettings() {
  const { data: me } = useMe();
  const updateUser = useUpdateUser(me?.id ?? "");

  const preferences: Preferences = {
    emailNotifications: me?.email_notifications_enabled ?? true,
  };

  const handleUpdatePreferences = async (next: Preferences): Promise<void> => {
    if (!me?.id) {
      return;
    }
    await updateUser.mutateAsync({
      email_notifications_enabled: next.emailNotifications,
    });
  };

  // const handleChangePassword = async (
  //   currentPassword: string,
  //   newPassword: string,
  // ): Promise<boolean> => {
  //   if (!currentPassword || !newPassword) {
  //     toastifier.error("Please complete all password fields");
  //     return false;
  //   }
  //   try {
  //     await UserService.changePassword(currentPassword, newPassword);
  //     return true;
  //   } catch {
  //     toastifier.error("Unable to update password");
  //     return false;
  //   }
  // };

  return (
    <section className="mx-auto max-w-3xl px-6 py-8 text-fg-1">
      <header className="border-b border-white/8 pb-6">
        <p className="section-label">Account</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-fg-3">
          Notifications, language and security
        </p>
      </header>

      <div className="mt-6 space-y-6">
        <PreferencesForm
          preferences={preferences}
          onUpdate={handleUpdatePreferences}
        />

        {/* <PasswordForm onChangePassword={handleChangePassword} /> */}

        {/* Identity (avatar, name, bio, delete account) lives on the profile page. */}
        <Link
          href="/profile"
          className="flex items-center justify-between gap-4 card-surface px-5 py-4 transition-colors hover:border-accent/20 hover:no-underline"
        >
          <div>
            <p className="font-sans text-sm font-700 uppercase tracking-[1px] text-fg-1">
              Profile &amp; Account
            </p>
            <p className="mt-0.5 text-sm text-fg-3">
              Edit your avatar, display name and bio, or delete your account
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 font-sans text-xs font-700 uppercase tracking-[1.5px] text-accent">
            Open <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </section>
  );
}
