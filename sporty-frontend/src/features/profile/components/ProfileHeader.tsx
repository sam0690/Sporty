"use client";

import { useState } from "react";
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
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !imageFailed;

  return (
    <header className="overflow-hidden card-surface">
      <div className="border-b border-white/8 px-6 py-5">
        <p className="section-label">Account</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
          Profile
        </h1>
        <p className="mt-1 text-sm text-fg-3">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-accent/20 bg-accent/10 font-display text-3xl tracking-[-0.02em] text-accent">
          {showImage ? (
            <Image
              src={avatarUrl}
              alt={`${userName} avatar`}
              width={80}
              height={80}
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            getInitials(userName)
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate font-sans text-xl font-700 uppercase tracking-[1px] text-fg-1">
            {userName}
          </p>
          <p className="truncate text-sm text-fg-3">{userEmail}</p>
          <button
            type="button"
            onClick={() => document.getElementById("avatar-upload")?.click()}
            className="mt-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-accent transition-colors hover:text-accent-bright"
          >
            Change Avatar
          </button>
        </div>
      </div>
    </header>
  );
}
