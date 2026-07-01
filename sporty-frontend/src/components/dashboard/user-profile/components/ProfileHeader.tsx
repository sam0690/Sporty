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
    <section className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-5">
      <div className="flex items-center gap-4">
        {avatar ? (
          <Image
            src={avatar}
            alt={`${name} avatar`}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-[3px] border border-[rgba(11,18,32,0.08)] object-cover"
          />
        ) : (
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[3px] border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.1)] font-bebas text-3xl tracking-[2px] text-[#DC2626]">
            {initial}
          </span>
        )}

        <div className="min-w-0">
          <p className="section-label">Public Profile</p>
          <h2 className="mt-1 truncate font-bebas text-3xl tracking-[2px] text-[#0B1220]">
            {name}
          </h2>
          <p className="text-xs text-[#6B7280]">Joined {formatDate(joinDate)}</p>
        </div>
      </div>

      {bio ? <p className="mt-4 text-sm text-[#6B7280]">{bio}</p> : null}
    </section>
  );
}
