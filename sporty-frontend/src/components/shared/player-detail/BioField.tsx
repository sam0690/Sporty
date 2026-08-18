"use client";

import { CountryFlag } from "@/components/ui";
import type { TPlayer } from "@/types";

/**
 * One labelled biographical value, hidden entirely when there is no value.
 *
 * Most players are missing at least one of these — height, weight and squad
 * number in particular are only available on paid tiers of our data
 * providers — so rendering an empty row would be the common case, not the
 * exception.
 */
export function BioField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
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

/** Nationality with its flag. The flag is omitted if we can't resolve one. */
export function NationalityField({ player }: { player: TPlayer }) {
  if (!player.nationality) {
    return null;
  }
  return (
    <div>
      <div className="micro-label text-fg-3">Nationality</div>
      <div className="mt-1 flex items-center gap-2 text-sm text-fg-1">
        <CountryFlag
          nationality={player.nationality}
          flagUrl={player.flag_url}
          size="md"
        />
        <span className="truncate">{player.nationality}</span>
      </div>
    </div>
  );
}

/**
 * Age in whole years.
 *
 * Prefers the server's computed `age`; the local fallback keeps older cached
 * API responses (which predate that field) rendering an age rather than a gap.
 */
export function playerAge(player: TPlayer): number | null {
  if (typeof player.age === "number") {
    return player.age;
  }
  if (!player.date_of_birth) {
    return null;
  }
  const dob = new Date(player.date_of_birth);
  const now = new Date();
  const hasNotHadBirthdayThisYear =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  return now.getFullYear() - dob.getFullYear() - (hasNotHadBirthdayThisYear ? 1 : 0);
}
