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
    <header className="flex flex-wrap items-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xl font-semibold text-primary-700">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${userName} avatar`} className="h-full w-full object-cover" />
          ) : (
            getInitials(userName)
          )}
        </div>

        <button
          type="button"
          onClick={() => document.getElementById("avatar-upload")?.click()}
          className="rounded-lg border border-primary-500 px-4 py-2 text-sm text-primary-500 transition-colors hover:bg-primary-50"
        >
          Change Avatar
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Profile Settings</h1>
        <p className="mt-1 text-text-secondary">Manage your account settings and preferences</p>
        <p className="mt-2 text-sm text-text-secondary">{userName} • {userEmail}</p>
      </div>
    </header>
  );
}
