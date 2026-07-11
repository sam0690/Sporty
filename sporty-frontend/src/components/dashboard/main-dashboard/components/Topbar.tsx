import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import type { OverviewStat } from "@/components/dashboard/main-dashboard/types";

type TopbarProps = {
  userName: string;
  userId: string;
  avatar?: string;
  leagues: Array<{ id: string; name: string }>;
  selectedLeagueId: string | null;
  onLeagueChange: (leagueId: string) => void;
  stats: OverviewStat[];
  statsLoading?: boolean;
};

function isPositiveChange(change: string): boolean {
  return change.trim().startsWith("+") || /^up\b/i.test(change.trim());
}

function StatSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div>
      <div className={`skeleton h-9 rounded-[3px] ${wide ? "w-24" : "w-14"}`} />
      <div className="skeleton mt-2 h-2.5 w-16 rounded-[3px]" />
    </div>
  );
}

export function Topbar({
  userName,
  userId,
  avatar,
  leagues,
  selectedLeagueId,
  onLeagueChange,
  stats,
  statsLoading = false,
}: TopbarProps) {
  const router = useRouter();
  const initial = userName.slice(0, 1).toUpperCase();

  const totalPoints = stats.find((s) => s.label === "Total Points");
  const rank = stats.find((s) => s.label === "Rank");
  const budget = stats.find((s) => s.label === "Budget");
  const gwPoints = stats.find((s) => s.label === "Gameweek Points");

  return (
    <header className="mb-6 overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-5 py-5 sm:px-8 sm:py-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="section-label">Welcome back</p>
          <h1 className="mt-1.5 truncate font-bebas text-3xl leading-none tracking-[1.5px] text-[#f8f8f8] sm:text-4xl">
            {userName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {budget && (
            <div
              className="rounded-[3px] border border-[rgba(255,255,255,0.1)] px-3.5 py-2 text-right"
              title="Available budget"
            >
              <span className="num font-barlow-condensed text-sm font-700 text-[#f0f0f0]">
                {statsLoading ? "—" : budget.value}
              </span>
              <span className="ml-1.5 text-[10px] uppercase tracking-[1px] text-[#666671]">
                budget
              </span>
            </div>
          )}

          <select
            value={selectedLeagueId ?? ""}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={leagues.length === 0}
            className="rounded-[3px] border border-[rgba(255,255,255,0.1)] bg-transparent px-3.5 py-2 font-barlow-condensed text-sm font-600 uppercase tracking-[0.5px] text-[#f0f0f0] transition-colors focus:border-[#e8fb25]/50 focus:outline-none disabled:opacity-50"
            aria-label="Choose active league"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => router.push(`/user/${userId}`)}
            className="group flex items-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.1)] p-1 pr-3 transition-colors hover:border-[rgba(232,251,37,0.3)]"
            aria-label="Open public profile"
          >
            {avatar ? (
              <Image
                src={avatar}
                alt={`${userName} avatar`}
                width={30}
                height={30}
                sizes="30px"
                className="h-[30px] w-[30px] rounded-full object-cover"
              />
            ) : (
              <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[rgba(232,251,37,0.1)] font-bebas text-sm text-[#e8fb25]">
                {initial}
              </span>
            )}
            <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#9a9aa5] group-hover:text-[#f0f0f0]">
              Profile
            </span>
            <ChevronRight className="size-3.5 text-[#555560] transition-colors group-hover:text-[#e8fb25]" />
          </button>
        </div>
      </div>

      <div className="my-5 h-px bg-[rgba(255,255,255,0.06)]" />

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        {statsLoading ? (
          <>
            <StatSkeleton wide />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            {totalPoints && (
              <div>
                <p className="num font-bebas text-6xl leading-none tracking-[1px] text-[#e8fb25] sm:text-7xl">
                  {totalPoints.value}
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="section-label">Total Points</p>
                  <p
                    className={`text-[11px] font-600 ${
                      isPositiveChange(totalPoints.change)
                        ? "text-[#00ff88]"
                        : "text-[#666671]"
                    }`}
                  >
                    {totalPoints.change}
                  </p>
                </div>
              </div>
            )}

            {(rank || gwPoints) && (
              <span className="hidden h-11 w-px bg-[rgba(255,255,255,0.08)] sm:block" />
            )}

            {rank && (
              <div>
                <p className="num font-bebas text-3xl leading-none tracking-[1px] text-[#f0f0f0]">
                  {rank.value}
                </p>
                <p className="section-label mt-1.5">Rank</p>
              </div>
            )}

            {gwPoints && (
              <div>
                <p className="num font-bebas text-3xl leading-none tracking-[1px] text-[#f0f0f0]">
                  {gwPoints.value}
                </p>
                <p className="section-label mt-1.5">This Gameweek</p>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
