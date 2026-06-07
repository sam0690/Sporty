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
    <header className="space-y-5 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5  ">
      <div>
        <h1 className="font-bebas tracking-[3px] text-[#f0f0f0]">
          Profile
        </h1>
        <p className="mt-1 text-sm text-[#555560]">
          Manage your account settings
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6 border-b border-[rgba(255,255,255,0.08)] pb-6">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[rgba(232,251,37,0.1)] text-xl font-600 text-[#e8fb25]">
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
          <p className="text-sm text-[#f0f0f0]">{userName}</p>
          <p className="text-sm text-[#555560]">{userEmail}</p>
          <button
            type="button"
            onClick={() => document.getElementById("avatar-upload")?.click()}
            className="mt-2 text-sm text-[#e8fb25] transition-colors hover:text-cyan-300 hover:underline"
          >
            Change Avatar
          </button>
        </div>
      </div>
    </header>
  );
}
