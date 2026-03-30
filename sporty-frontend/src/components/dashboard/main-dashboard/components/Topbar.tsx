type TopbarProps = {
  userName: string;
  avatar?: string;
};

export function Topbar({ userName, avatar }: TopbarProps) {
  const initial = userName.slice(0, 1).toUpperCase();

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-light bg-surface-100 p-4 shadow-card">
      <div>
        <p className="text-sm text-text-secondary">Welcome back, {userName}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Overview</h1>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border-light bg-surface px-3 py-2">
        <div className="text-right">
          <p className="text-sm font-medium text-text-primary">{userName}</p>
          <p className="text-xs text-text-secondary">Team Manager</p>
        </div>
        {avatar ? (
          <img
            src={avatar}
            alt={`${userName} avatar`}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initial}
          </span>
        )}
      </div>
    </header>
  );
}
