import Image from "next/image";
import { ChevronRight } from "lucide-react";
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
    <header className="pop-in relative isolate mb-6 overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[#14141b] to-[#0f0f14] px-5 py-6 sm:px-8 sm:py-8">
      <div
        aria-hidden
        className="glow-orb -left-16 -top-20 size-56 bg-[#e8fb25] opacity-[0.1] sm:size-72"
      />
      <div
        aria-hidden
        className="glow-orb -right-10 -bottom-20 size-56 bg-[#00d4ff] opacity-[0.08] sm:size-72"
      />
      <div aria-hidden className="grain-overlay" />

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="section-label">Welcome back</p>
          <h1 className="mt-2 truncate font-bebas text-4xl leading-none tracking-[2px] text-[#f8f8f8] sm:text-5xl">
            {userName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-52">
            <span className="section-label mb-1.5 block">Active League</span>
            <select
              value={selectedLeagueId ?? ""}
              onChange={(event) => onLeagueChange(event.target.value)}
              disabled={leagues.length === 0}
              className="w-full rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[#1a1a22] px-3.5 py-2.5 font-barlow-condensed text-sm font-600 uppercase tracking-[0.5px] text-[#f0f0f0] transition-colors focus:border-[#e8fb25]/50 focus:outline-none disabled:opacity-50"
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
            className="group flex items-center gap-3 rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[#1a1a22] py-2 pl-3.5 pr-2.5 text-left transition-colors hover:border-[rgba(232,251,37,0.3)]"
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
                width={38}
                height={38}
                sizes="38px"
                className="h-[38px] w-[38px] rounded-[8px] object-cover ring-1 ring-white/10"
              />
            ) : (
              <span className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border border-[rgba(232,251,37,0.25)] bg-[rgba(232,251,37,0.08)] font-bebas text-lg tracking-wider text-[#e8fb25]">
                {initial}
              </span>
            )}
            <ChevronRight className="size-4 shrink-0 text-[#555560] transition-colors group-hover:text-[#e8fb25]" />
          </button>
        </div>
      </div>
    </header>
  );
}
