import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import type { OverviewStat } from "../types";

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
    <header className="mb-6 overflow-hidden card-surface px-5 py-5 sm:px-8 sm:py-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="section-label">Welcome back</p>
          <h1 className="mt-1.5 truncate font-display text-3xl leading-none tracking-[-0.02em] text-fg-1 sm:text-4xl">
            {userName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {budget && (
            <div
              className="rounded-[3px] border border-white/10 px-3.5 py-2 text-right"
              title="Available budget"
            >
              <span className="num font-sans text-sm font-700 text-fg-1">
                {statsLoading ? "—" : budget.value}
              </span>
              <span className="ml-1.5 text-[10px] uppercase tracking-[1px] text-fg-3">
                budget
              </span>
            </div>
          )}

          <select
            value={selectedLeagueId ?? ""}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={leagues.length === 0}
            className="rounded-[3px] border border-white/10 bg-transparent px-3.5 py-2 font-sans text-sm font-600 uppercase tracking-[0.5px] text-fg-1 transition-colors focus:border-accent/50 focus:outline-none disabled:opacity-50"
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
            className="group flex items-center gap-2 rounded-[3px] border border-white/10 p-1 pr-3 transition-colors hover:border-accent/30"
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
              <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent/10 font-display text-sm text-accent">
                {initial}
              </span>
            )}
            <span className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 group-hover:text-fg-1">
              Profile
            </span>
            <ChevronRight className="size-3.5 text-fg-3 transition-colors group-hover:text-accent" />
          </button>
        </div>
      </div>

      <div className="my-5 h-px bg-white/6" />

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
                <p className="num font-display text-6xl leading-none tracking-[-0.02em] text-accent sm:text-7xl">
                  {totalPoints.value}
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="section-label">Total Points</p>
                  <p
                    className={`text-[11px] font-600 ${
                      isPositiveChange(totalPoints.change)
                        ? "text-success"
                        : "text-fg-3"
                    }`}
                  >
                    {totalPoints.change}
                  </p>
                </div>
              </div>
            )}

            {(rank || gwPoints) && (
              <span className="hidden h-11 w-px bg-white/8 sm:block" />
            )}

            {rank && (
              <div>
                <p className="num font-display text-3xl leading-none tracking-[-0.02em] text-fg-1">
                  {rank.value}
                </p>
                <p className="section-label mt-1.5">Rank</p>
              </div>
            )}

            {gwPoints && (
              <div>
                <p className="num font-display text-3xl leading-none tracking-[-0.02em] text-fg-1">
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
