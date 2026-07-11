// Clean single-colour sport glyphs for the landing + auth surfaces. They draw
// with `currentColor` and size from className, replacing the ⚽🏀🏏 emoji that
// clashed with the broadcast design system.

type IconProps = {
  className?: string;
};

function Base({
  children,
  className,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "size-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function FootballGlyph({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2l3.4 2.5-1.3 4h-4.2l-1.3-4z" />
      <path d="M12 7.2V3.5M15.4 9.7l3.5-1.2M14.1 13.7l2.2 3M9.9 13.7l-2.2 3M8.6 9.7L5.1 8.5" />
    </Base>
  );
}

export function BasketballGlyph({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
      <path d="M5.6 5.6c3.2 2 3.2 10.8 0 12.8M18.4 5.6c-3.2 2-3.2 10.8 0 12.8" />
    </Base>
  );
}

export function CricketGlyph({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M14.5 3.5l6 6-9.5 9.5-6-6z" />
      <path d="M6 15l-2.5 5.5L9 18" />
      <circle cx="18" cy="6" r="1.3" fill="currentColor" />
    </Base>
  );
}

export function BoltGlyph({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" fill="currentColor" />
    </Base>
  );
}

export type SportGlyph = {
  Icon: (props: IconProps) => React.ReactElement;
  label: string;
  color: string;
};

export const SPORT_GLYPHS: SportGlyph[] = [
  { Icon: FootballGlyph, label: "Football", color: "#00ff88" },
  { Icon: BasketballGlyph, label: "Basketball", color: "#ff6b35" },
];

const SPORT_GLYPH_MAP: Record<string, SportGlyph> = {
  football: SPORT_GLYPHS[0],
  soccer: SPORT_GLYPHS[0],
  basketball: SPORT_GLYPHS[1],
};

const MULTISPORT_GLYPH: SportGlyph = {
  Icon: BoltGlyph,
  label: "Multi-sport",
  color: "#e2c368",
};

// Resolve a sport name (from the API) to its glyph; unknown / mixed leagues
// fall back to the volt multi-sport mark.
export function sportGlyph(sport?: string | null): SportGlyph {
  return SPORT_GLYPH_MAP[(sport ?? "").toLowerCase()] ?? MULTISPORT_GLYPH;
}
