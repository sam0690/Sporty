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
    <header className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <div className="border-b border-[rgba(255,255,255,0.08)] px-6 py-5">
        <p className="section-label">Account</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-6xl">
          Profile
        </h1>
        <p className="mt-1 text-sm text-[#555560]">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-[rgba(232,251,37,0.2)] bg-[rgba(232,251,37,0.1)] font-bebas text-3xl tracking-[2px] text-[#e8fb25]">
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

        <div className="min-w-0">
          <p className="truncate font-barlow-condensed text-xl font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            {userName}
          </p>
          <p className="truncate text-sm text-[#555560]">{userEmail}</p>
          <button
            type="button"
            onClick={() => document.getElementById("avatar-upload")?.click()}
            className="mt-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#e8fb25] transition-colors hover:text-[#f0ff45]"
          >
            Change Avatar
          </button>
        </div>
      </div>
    </header>
  );
}
