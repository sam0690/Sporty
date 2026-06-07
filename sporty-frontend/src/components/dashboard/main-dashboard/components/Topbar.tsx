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
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5">
      <div>
        <p className="section-label">Welcome back</p>
        <h1 className="mt-1 font-bebas text-4xl tracking-[3px] text-[#f0f0f0]">
          {userName}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-52">
          <span className="section-label mb-1 block">Active League</span>
          <select
            value={selectedLeagueId ?? ""}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={leagues.length === 0}
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.12)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] transition-colors focus:border-[#e8fb25] focus:outline-none"
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
          className="flex items-center gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-left transition-colors hover:border-white/15"
          aria-label="Open public profile"
        >
          <div className="text-right">
            <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
              {userName}
            </p>
            <p className="section-label">Team Manager</p>
          </div>
          {avatar ? (
            <Image
              src={avatar}
              alt={`${userName} avatar`}
              width={36}
              height={36}
              sizes="36px"
              className="h-9 w-9 rounded-[3px] object-cover"
            />
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[3px] bg-[#1d1d26] border border-[rgba(232,251,37,0.2)] font-bebas text-xl tracking-wider text-[#e8fb25]">
              {initial}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
