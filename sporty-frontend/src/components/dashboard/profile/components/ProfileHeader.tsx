"use client";

import Image from "next/image";

type ProfileHeaderProps = {
  userName: string;
  userEmail: string;
  avatarUrl: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function ProfileHeader({
  userName,
  userEmail,
  avatarUrl,
}: ProfileHeaderProps) {
  return (
    <header className="space-y-5 rounded-4xl border border-white/10 bg-surface/75 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[0.04em] text-foreground uppercase">
          Profile
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your account settings
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6 border-b border-white/10 pb-6">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-accent-primary/15 text-xl font-semibold text-accent-primary">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={`${userName} avatar`}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(userName)
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">{userName}</p>
          <p className="text-sm text-slate-400">{userEmail}</p>
          <button
            type="button"
            onClick={() => document.getElementById("avatar-upload")?.click()}
            className="mt-2 text-sm font-medium text-accent-primary transition-colors hover:text-cyan-300 hover:underline"
          >
            Change Avatar
          </button>
        </div>
      </div>
    </header>
  );
}
