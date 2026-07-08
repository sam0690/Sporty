"use client";

import Image from "next/image";

type ProfileHeaderProps = {
  name: string;
  avatar: string;
  bio?: string;
  joinDate: string;
};

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProfileHeader({
  name,
  avatar,
  bio,
  joinDate,
}: ProfileHeaderProps) {
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <section className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#121218] p-5">
      <div className="flex items-center gap-4">
        {avatar ? (
          <Image
            src={avatar}
            alt={`${name} avatar`}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[rgba(232,251,37,0.1)] font-bebas text-3xl tracking-[2px] text-[#e8fb25]">
            {initial}
          </span>
        )}

        <div className="min-w-0">
          <p className="section-label">Public Profile</p>
          <h2 className="mt-1 truncate font-bebas text-3xl tracking-[2px] text-[#f0f0f0]">
            {name}
          </h2>
          <p className="text-xs text-[#666671]">Joined {formatDate(joinDate)}</p>
        </div>
      </div>

      {bio ? <p className="mt-4 text-sm text-[#9a9aa5]">{bio}</p> : null}
    </section>
  );
}
