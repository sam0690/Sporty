"use client";

import { useState } from "react";

import { sportGlyph } from "@/components/landing/sport-icons";
import { competitionLogo, competitionLogoByName } from "@/lib/footballCompetitions";

type CompetitionLogoProps = {
  /** Either a tag ("EPL"|…|"UCL") or a display name ("Premier League"). */
  tag?: string;
  name?: string;
  /** Fallback sport for the glyph when there's no logo (NBA/Cricket). */
  sport?: string;
  /** Size utility, e.g. "size-5". Applies to both the logo and the fallback. */
  className?: string;
};

// The competition emblem (football-data.org, like club crests), with a graceful
// fallback to the sport glyph for competitions without a logo or if the image
// fails to load.
export function CompetitionLogo({
  tag,
  name,
  sport = "football",
  className = "size-5",
}: CompetitionLogoProps) {
  const logo = tag ? competitionLogo(tag) : competitionLogoByName(name);
  const [errored, setErrored] = useState(false);

  if (logo && !errored) {
    // Seat the emblem on a light chip — several league logos (Premier League,
    // Champions League) are dark-toned and designed for light backgrounds, so
    // they blend into the dark UI otherwise.
    return (
      <span
        className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-[4px] bg-white/95 p-[2px]`}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          loading="lazy"
          onError={() => setErrored(true)}
          className="size-full object-contain"
        />
      </span>
    );
  }

  const glyph = sportGlyph(sport);
  const Glyph = glyph.Icon;
  return (
    <span
      className={`${className} grid shrink-0 place-items-center rounded-[4px]`}
      style={{ color: glyph.color, background: `${glyph.color}1a` }}
      aria-hidden="true"
    >
      <Glyph className="size-[62%]" />
    </span>
  );
}
