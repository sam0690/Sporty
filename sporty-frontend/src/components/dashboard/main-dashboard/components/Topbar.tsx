type TopbarProps = {
  userName: string;
  avatar?: string;
};

export function Topbar({ userName, avatar }: TopbarProps) {
  const initial = userName.slice(0, 1).toUpperCase();

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5">
      <div>
        <p className="text-sm text-gray-500">Welcome back, {userName}</p>
        <h1 className="text-2xl font-light tracking-tight text-gray-900">Overview</h1>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">{userName}</p>
          <p className="text-xs text-gray-500">Team Manager</p>
        </div>
        {avatar ? (
          <img
            src={avatar}
            alt={`${userName} avatar`}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
            {initial}
          </span>
        )}
      </div>
    </header>
  );
}
