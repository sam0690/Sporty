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
    <header className="overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
      <div className="border-b border-[rgba(11,18,32,0.08)] px-6 py-5">
        <p className="section-label">Account</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#0B1220] sm:text-6xl">
          Profile
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.1)] font-bebas text-3xl tracking-[2px] text-[#DC2626]">
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
          <p className="truncate font-barlow-condensed text-xl font-bold uppercase tracking-[1px] text-[#0B1220]">
            {userName}
          </p>
          <p className="truncate text-sm text-[#6B7280]">{userEmail}</p>
          <button
            type="button"
            onClick={() => document.getElementById("avatar-upload")?.click()}
            className="mt-2 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#DC2626] transition-colors hover:text-[#B91C1C]"
          >
            Change Avatar
          </button>
        </div>
      </div>
    </header>
  );
}
