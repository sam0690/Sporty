"use client";

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

export function ProfileHeader({ userName, userEmail, avatarUrl }: ProfileHeaderProps) {
  return (
    <header className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">Profile</h1>
        <p className="mt-1 text-sm text-secondary">Manage your account settings</p>
      </div>

      <div className="flex flex-wrap items-center gap-6 border-b border-accent/20 pb-6">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-accent/30 text-xl font-semibold text-secondary">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${userName} avatar`} className="h-full w-full object-cover" />
          ) : (
            getInitials(userName)
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-black">{userName}</p>
          <p className="text-sm text-secondary">{userEmail}</p>
          <button
            type="button"
            onClick={() => document.getElementById("avatar-upload")?.click()}
            className="mt-2 text-sm text-primary-500 transition-colors hover:underline"
          >
            Change Avatar
          </button>
        </div>
      </div>
    </header>
  );
}
