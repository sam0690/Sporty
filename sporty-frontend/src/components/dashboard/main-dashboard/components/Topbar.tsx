import Image from "next/image";

import { useRouter } from "next/navigation";

type TopbarProps = {
  userName: string;
  userId: string;
  avatar?: string;
  leagues: Array<{ id: string; name: string }>;
  selectedLeagueId: string | null;
  onLeagueChange: (leagueId: string) => void;
};

export function Topbar({
  userName,
  userId,
  avatar,
  leagues,
  selectedLeagueId,
  onLeagueChange,
}: TopbarProps) {
  const router = useRouter();
  const initial = userName.slice(0, 1).toUpperCase();

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5">
      <div>
        <p className="text-sm text-gray-500">Welcome back, {userName}</p>
        <h1 className="text-2xl font-light tracking-tight text-gray-900">
          Overview
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-52">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            Active League
          </span>
          <select
            value={selectedLeagueId ?? ""}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={leagues.length === 0}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none"
            aria-label="Choose active league"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => router.push(`/user/${userId}`)}
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
          aria-label="Open public profile"
        >
          <div className="text-right">
            <p className="text-sm font-medium text-gray-800">{userName}</p>
            <p className="text-xs text-gray-500">Team Manager</p>
          </div>
          {avatar ? (
            <Image
              src={avatar}
              alt={`${userName} avatar`}
              width={36}
              height={36}
              sizes="36px"
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
              {initial}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
