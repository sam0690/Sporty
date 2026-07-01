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
    <header className="surface mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
      <div>
        <p className="kicker">Welcome back</p>
        <h1 className="mt-1.5 font-condensed text-4xl font-bold uppercase leading-none tracking-[0.01em] text-ink">
          {userName}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-52">
          <span className="micro-label mb-1.5 block">Active League</span>
          <select
            value={selectedLeagueId ?? ""}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={leagues.length === 0}
            className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
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
          className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface-muted"
          aria-label="Open public profile"
        >
          <div className="text-right">
            <p className="font-condensed text-sm font-bold uppercase tracking-[0.04em] text-ink">
              {userName}
            </p>
            <p className="micro-label">Team Manager</p>
          </div>
          {avatar ? (
            <Image
              src={avatar}
              alt={`${userName} avatar`}
              width={36}
              height={36}
              sizes="36px"
              className="h-9 w-9 rounded-sm object-cover"
            />
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-primary-soft font-condensed text-xl font-bold tracking-wide text-primary">
              {initial}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
