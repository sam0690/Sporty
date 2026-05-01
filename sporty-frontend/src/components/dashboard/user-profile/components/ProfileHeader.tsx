"use client";

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

export function ProfileHeader({ name, avatar, bio, joinDate }: ProfileHeaderProps) {
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <section className="rounded-lg border border-accent/20 bg-white p-5">
      <div className="flex items-center gap-4">
        {avatar ? (
          <img src={avatar} alt={`${name} avatar`} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/30 text-xl font-semibold text-black">
            {initial}
          </span>
        )}

        <div>
          <h2 className="text-xl font-medium text-black">{name}</h2>
          <p className="text-sm text-secondary">Joined {formatDate(joinDate)}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-secondary">{bio}</p>
    </section>
  );
}
