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
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-accent/20 bg-white p-5 shadow-card">
      <div>
        <p className="text-sm text-secondary">Welcome back, {userName}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-black">
          Overview
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-52">
          <span className="mb-1 block text-xs font-medium text-secondary">
            Active League
          </span>
          <select
            value={selectedLeagueId ?? ""}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={leagues.length === 0}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-black focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200"
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
          className="flex items-center gap-3 rounded-md border border-accent/20 bg-[#F4F4F9] px-3 py-2 text-left hover:bg-accent/20 transition-colors duration-200"
          aria-label="Open public profile"
        >
          <div className="text-right">
            <p className="text-sm font-medium text-black">{userName}</p>
            <p className="text-xs text-secondary">Team Manager</p>
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
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {initial}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
