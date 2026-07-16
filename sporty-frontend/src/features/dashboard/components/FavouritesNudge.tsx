"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useMe } from "@/hooks/auth/useMe";
import { ROUTES } from "@/lib/route.config";
import { getLocalStorage, setLocalStorage } from "@/lib/storage.local";
import { LocalStorageKeys } from "@/lib/storage.keys";

/**
 * Dismissible prompt for users who skipped (or never saw) the favourites
 * onboarding step. Dismissal is per-browser, not per-user — fine for a nudge.
 */
export function FavouritesNudge() {
  const { data: me, isLoading } = useMe();
  const [dismissed, setDismissed] = useState(
    () => getLocalStorage(LocalStorageKeys.FAVOURITES_NUDGE_DISMISSED) === "1",
  );

  const hasFavourites =
    (me?.favourite_teams?.length ?? 0) > 0 ||
    (me?.favourite_players?.length ?? 0) > 0;

  if (isLoading || !me || hasFavourites || dismissed) {
    return null;
  }

  const dismiss = () => {
    setLocalStorage(LocalStorageKeys.FAVOURITES_NUDGE_DISMISSED, "1");
    setDismissed(true);
  };

  return (
    <div className="mb-6 flex flex-col gap-4 card-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="section-label">Favourites</p>
        <p className="mt-1 text-sm text-fg-2">
          Pick a favourite team and player to get notified the moment they
          score.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.ONBOARDING_FAVOURITES.path}
          className="rounded-[3px] bg-accent px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
        >
          Pick favourites
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss favourites reminder"
          className="rounded-[3px] p-2 text-fg-3 transition-colors hover:text-fg-1"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
