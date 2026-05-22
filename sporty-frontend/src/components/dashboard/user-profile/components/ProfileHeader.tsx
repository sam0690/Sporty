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
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
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
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent-primary/20 text-xl font-semibold text-foreground">
            {initial}
          </span>
        )}

        <div>
          <h2 className="text-xl font-medium text-foreground">{name}</h2>
          <p className="text-sm text-foreground/60">
            Joined {formatDate(joinDate)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-foreground/65">{bio}</p>
    </section>
  );
}
