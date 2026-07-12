"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usePlayer, usePlayerRecentStats } from "@/hooks/players/usePlayers";
import { PlayerHero } from "./PlayerHero";
import { PlayerRecentStats } from "./PlayerRecentStats";
import { PlayerStatSparkline } from "./PlayerStatSparkline";

type PlayerDetailPageViewProps = {
  playerId: string;
};

const RECENT_STATS_LIMIT = 10;

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasNotHadBirthdayThisYear =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (hasNotHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

function BioField({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return (
    <div>
      <div className="micro-label text-fg-3">{label}</div>
      <div className="mt-1 text-sm text-fg-1">{value}</div>
    </div>
  );
}

/** Rich standalone profile — the real players/[id]/page.tsx, reached by
 * direct navigation or refresh (not through the intercepted modal). */
export function PlayerDetailPageView({ playerId }: PlayerDetailPageViewProps) {
  const router = useRouter();
  const { data: player, isLoading, isError } = usePlayer(playerId);
  const { data: recentStats, isLoading: statsLoading } = usePlayerRecentStats(
    playerId,
    RECENT_STATS_LIMIT,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-sm text-fg-2 transition-colors hover:text-fg-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="overflow-hidden card-surface text-fg-1">
        {isLoading && (
          <div className="p-6">
            <div className="skeleton h-24 w-24 rounded-[3px]" />
            <div className="skeleton mt-4 h-6 w-52 rounded-[3px]" />
            <div className="skeleton mt-2 h-4 w-32 rounded-[3px]" />
          </div>
        )}

        {!isLoading && (isError || !player) && (
          <div className="p-6 text-center">
            <p className="text-sm text-fg-1/65">Couldn&apos;t load this player. Try again.</p>
          </div>
        )}

        {!isLoading && player && (
          <>
            <PlayerHero player={player} size="large" />

            <div className="grid grid-cols-2 gap-4 border-t border-white/6 px-6 py-5 sm:grid-cols-3">
              <BioField label="Nationality" value={player.nationality} />
              <BioField
                label="Age"
                value={player.date_of_birth ? calculateAge(player.date_of_birth) : null}
              />
              <BioField label="Height" value={player.height} />
              <BioField label="Weight" value={player.weight} />
              <BioField label="Squad Number" value={player.jersey_number} />
              <BioField label="Agent" value={player.agent} />
              <BioField label="Wage" value={player.wage} />
              <BioField label="Signing Fee" value={player.signing_fee} />
              <BioField label="Date Signed" value={player.date_signed} />
            </div>

            {player.bio && (
              <div className="border-t border-white/6 px-6 py-5">
                <div className="micro-label text-fg-3">About</div>
                <p className="mt-2 text-sm leading-relaxed text-fg-2">{player.bio}</p>
              </div>
            )}

            {recentStats && recentStats.length >= 2 && (
              <div className="border-t border-white/6 px-6 py-5">
                <PlayerStatSparkline stats={recentStats} />
              </div>
            )}

            <div className="border-t border-white/6 px-6 py-5">
              <div className="micro-label mb-3 text-fg-3">Recent Performance</div>
              <PlayerRecentStats stats={recentStats} isLoading={statsLoading} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
