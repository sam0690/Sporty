"use client";

import {
  FootballGlyph,
  BasketballGlyph,
  CricketGlyph,
} from "@/components/landing/sport-icons";

// Subtle decorative sport glyphs behind the auth card. SVG (not emoji) per
// Design_System.md §4.
export function FloatingSportsIcons() {
  return (
    <>
      <FootballGlyph className="pointer-events-none absolute left-6 top-14 -z-10 size-8 text-ink-faint/50" />
      <BasketballGlyph className="pointer-events-none absolute right-10 top-20 -z-10 size-8 text-ink-faint/50" />
      <CricketGlyph className="pointer-events-none absolute bottom-16 left-14 -z-10 size-8 text-ink-faint/50" />
    </>
  );
}
