"use client";

import Image from "next/image";

type ProfileHeaderProps = {
  name: string;
  avatar: string;
  bio: string;
  joinDate: string;
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
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
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
      <div className="flex items-center gap-4">
        {avatar ? (
          <Image
            src={avatar}
            alt={`${name} avatar`}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-[3px] bg-[rgba(232,251,37,0.2)] text-xl font-600 text-[#f0f0f0]">
            {initial}
          </span>
        )}

        <div>
          <h2 className="font-bebas text-3xl tracking-[2px] text-[#f0f0f0]">{name}</h2>
          <p className="text-sm text-[#555560]">
            Joined {formatDate(joinDate)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-[#555560]">{bio}</p>
    </section>
  );
}
