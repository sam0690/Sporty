"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePublicPlayer, usePublicPlayerRecentStats } from "@/hooks/players/usePlayers";
import { PlayerHero } from "./PlayerHero";
import { PlayerRecentStats } from "./PlayerRecentStats";
import { PlayerStatSparkline } from "./PlayerStatSparkline";

type PublicPlayerProfileViewProps = {
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

/** Shareable, no-login player profile — reached via /p/[id]. Same building
 * blocks as the in-app full page (PlayerDetailPageView), sourced from the
 * public endpoints instead. */
export function PublicPlayerProfileView({ playerId }: PublicPlayerProfileViewProps) {
  const { data: player, isLoading, isError } = usePublicPlayer(playerId);
  const { data: recentStats, isLoading: statsLoading } = usePublicPlayerRecentStats(
    playerId,
    RECENT_STATS_LIMIT,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
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
            <p className="text-sm text-fg-1/65">Couldn&apos;t load this player.</p>
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

      <div className="mt-8 flex flex-col items-center gap-3 rounded-[3px] border border-accent/22 bg-accent/4 p-8 text-center sm:p-12">
        <p className="font-display text-3xl tracking-[-0.02em] text-fg-1 sm:text-4xl">
          Draft {player?.display_name ?? "this player"} on your team
        </p>
        <p className="max-w-md text-sm text-fg-2">
          Build a fantasy squad, set your lineup, and score from every match — across
          football, basketball and cricket.
        </p>
        <Link
          href="/register"
          className="mt-1 inline-flex items-center gap-1.5 rounded-[3px] bg-accent px-6 py-3 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright hover:no-underline"
        >
          Get Started Free <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
