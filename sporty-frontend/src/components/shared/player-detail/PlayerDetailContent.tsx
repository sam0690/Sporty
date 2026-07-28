"use client";

import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { usePlayer, usePlayerRecentStats } from "@/hooks/players/usePlayers";
import { profileSlug } from "@/utils/profileSlug";
import { PlayerHero } from "./PlayerHero";
import { PlayerRecentStats } from "./PlayerRecentStats";
import { FantasyPointsBreakdown } from "@/components/shared/scoring";
import { PlayerStatSparkline } from "./PlayerStatSparkline";

type PlayerDetailContentProps = {
  playerId: string;
};

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

/** Compact quick-glance view used by the intercepted modal route. */
export function PlayerDetailContent({ playerId }: PlayerDetailContentProps) {
  const { data: player, isLoading, isError } = usePlayer(playerId);
  const { data: recentStats, isLoading: statsLoading } = usePlayerRecentStats(playerId);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="skeleton h-16 w-16 rounded-[3px]" />
        <div className="skeleton mt-4 h-5 w-40 rounded-[3px]" />
        <div className="skeleton mt-2 h-4 w-24 rounded-[3px]" />
      </div>
    );
  }

  if (isError || !player) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-fg-1/65">
          Couldn&apos;t load this player. Try again.
        </p>
      </div>
    );
  }

  return (
    <>
      <PlayerHero player={player} size="compact" />

      <div className="grid grid-cols-2 gap-4 border-t border-white/6 px-6 py-4">
        <BioField label="Nationality" value={player.nationality} />
        <BioField
          label="Age"
          value={player.date_of_birth ? calculateAge(player.date_of_birth) : null}
        />
      </div>

      {recentStats && recentStats.length >= 2 && (
        <div className="border-t border-white/6 px-6 py-4">
          <PlayerStatSparkline stats={recentStats} />
        </div>
      )}

      {(() => {
        // Latest gameweek that carries a breakdown → show the explainable
        // Fantasy Points section (Task 1). Generic: renders whatever actions
        // the engine recorded, no hardcoded categories.
        const latest = [...(recentStats ?? [])]
          .filter((s) => s.breakdown && s.breakdown.length > 0)
          .sort((a, b) => b.transfer_window.number - a.transfer_window.number)[0];
        if (!latest) return null;
        return (
          <div className="border-t border-white/6 px-6 py-4">
            <FantasyPointsBreakdown
              title={`Fantasy Points · GW ${latest.transfer_window.number}`}
              total={latest.fantasy_points}
              events={latest.breakdown ?? []}
            />
          </div>
        );
      })()}

      <div className="border-t border-white/6 px-6 py-4">
        <div className="micro-label mb-3 text-fg-3">Recent Performance</div>
        <PlayerRecentStats stats={recentStats} isLoading={statsLoading} />
      </div>

      <div className="flex gap-2 border-t border-white/6 px-6 py-4">
        {/* Plain anchor, not next/link — intentional. This route is already
            intercepted (@modal/(.)players/[id]); a client-side navigation to
            the same URL would just re-render the modal. A full page load is
            the only way to reach the real players/[id]/page.tsx. */}
        <a
          href={`/players/${profileSlug(player.name, playerId)}`}
          className="flex-1 rounded-[3px] border border-white/12 px-4 py-2.5 text-center font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
        >
          View Full Profile
        </a>
        <ShareProfileButton
          path={`/p/${profileSlug(player.name, playerId)}`}
          label=""
          className="flex items-center justify-center rounded-[3px] border border-white/12 px-4 text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
        />
      </div>
    </>
  );
}
