"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui";
import { matchIdentities } from "@/lib/teamIdentity";
import type { TMatch } from "@/types/match";
import { useFavouriteLiveMatches } from "../hooks/useFavouriteLiveMatches";

/** Constant scroll speed regardless of how many matches are live. */
const SCROLL_PX_PER_SECOND = 55;

function TickerItem({
  match,
  tabbable,
}: {
  match: TMatch;
  tabbable: boolean;
}) {
  const { home, away } = matchIdentities(match.home_team, match.away_team);

  return (
    <Link
      href={`/match/${match.id}`}
      tabIndex={tabbable ? 0 : -1}
      aria-hidden={tabbable ? undefined : true}
      className="group/item inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap px-6 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-danger animate-live-pulse"
      />
      <span className="font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1 transition-colors group-hover/item:text-accent">
        {match.home_team}
      </span>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: home.color }}
      />
      <span className="font-display text-base leading-none tracking-[-0.02em] tabular-nums text-fg-1">
        <span>{match.home_score ?? 0}</span>
        <span className="px-0.5 text-white/25">:</span>
        <span>{match.away_score ?? 0}</span>
      </span>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: away.color }}
      />
      <span className="font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1 transition-colors group-hover/item:text-accent">
        {match.away_team}
      </span>
      {match.minute != null && (
        <span className="font-sans text-xs font-700 tabular-nums text-fg-3">
          {match.minute}&#8242;
        </span>
      )}
    </Link>
  );
}

/**
 * Slim marquee of the user's favourite teams' in-progress matches. Renders
 * nothing when the user has no favourites or none of them is playing.
 *
 * Marquee anatomy: the track holds two identical halves and slides -50%
 * (see .ticker-track in globals.css), so the loop is seamless. Score/minute
 * updates mutate text inside the moving track — the animation is untouched.
 * Only a change in WHICH matches are live remounts the track (keyed below),
 * masked by the house fade-in.
 */
export function LiveMatchTicker() {
  const { matches } = useFavouriteLiveMatches();

  const viewportRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef<HTMLDivElement>(null);
  // Copies of the match list per half — bumped until a half overflows the
  // viewport, which the -50% loop needs to be gapless.
  const [repeats, setRepeats] = useState(1);
  const [durationSec, setDurationSec] = useState(40);

  const membershipKey = matches.map((m) => m.id).join("|");

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const half = halfRef.current;
    if (!viewport || !half || matches.length === 0) {
      return;
    }
    const measure = () => {
      const sequenceWidth = half.scrollWidth / repeats;
      if (sequenceWidth <= 0) {
        return;
      }
      const needed = Math.max(1, Math.ceil(viewport.clientWidth / sequenceWidth));
      if (needed !== repeats) {
        setRepeats(needed);
        return; // re-measure after re-render with the right copy count
      }
      setDurationSec(Math.max(15, half.scrollWidth / SCROLL_PX_PER_SECOND));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
    // membershipKey re-measures when the set of live matches changes.
  }, [repeats, membershipKey, matches.length]);

  if (matches.length === 0) {
    return null;
  }

  const half = (ariaHidden: boolean) => (
    <div
      ref={ariaHidden ? undefined : halfRef}
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center"
    >
      {Array.from({ length: repeats }, (_, copy) =>
        matches.map((match) => (
          <TickerItem
            key={`${copy}-${match.id}`}
            match={match}
            // Exactly one tabbable copy of each match, so keyboard users
            // don't tab through duplicates.
            tabbable={!ariaHidden && copy === 0}
          />
        )),
      )}
    </div>
  );

  return (
    <section
      aria-label="Live matches — your favourite teams"
      className="pop-in mb-6 flex items-center overflow-hidden card-surface"
    >
      <div className="flex shrink-0 items-center gap-2 border-r border-white/8 px-4 py-2.5">
        <Badge tone="danger" className="gap-1.5 text-[10px] tracking-[2px]">
          <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
          Live
        </Badge>
      </div>
      <div
        key={membershipKey}
        ref={viewportRef}
        className="ticker-viewport animate-fade-in-scale min-w-0 flex-1"
      >
        <div
          className="ticker-track flex w-max items-center"
          style={{ "--ticker-duration": `${durationSec}s` } as React.CSSProperties}
        >
          {half(false)}
          {half(true)}
        </div>
      </div>
    </section>
  );
}
