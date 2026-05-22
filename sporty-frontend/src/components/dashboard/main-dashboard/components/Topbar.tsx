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
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-surface/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div>
        <p className="text-sm text-slate-400">Welcome back, {userName}</p>
        <h1 className="font-display text-2xl font-bold tracking-[0.04em] text-foreground uppercase">
          Overview
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-52">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Active League
          </span>
          <select
            value={selectedLeagueId ?? ""}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={leagues.length === 0}
            className="w-full rounded-xl border border-white/10 bg-surface-strong px-3 py-2 text-sm text-foreground transition-all duration-200 focus:border-accent-primary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/25"
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
          className="flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-primary/30 hover:bg-accent-primary/10"
          aria-label="Open public profile"
        >
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-xs text-slate-400">Team Manager</p>
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
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary/15 text-sm font-bold text-accent-primary">
              {initial}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
