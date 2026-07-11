// Clean, single-colour SVG icon set for the live match view. Every icon draws
// with `currentColor` and inherits sizing from its className, so callers control
// colour + size from Tailwind. This replaces the emoji glyphs the match page
// used to render, which looked inconsistent against the broadcast design system.

type IconProps = {
  className?: string;
};

function Svg({
  children,
  className,
  filled = false,
}: IconProps & { children: React.ReactNode; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "size-4"}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function GoalIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5l2.6 1.9-1 3h-3.2l-1-3z" />
      <path d="M12 7.5V4.5M14.6 9.4l2.7-1M13.6 12.4l1.7 2.4M10.4 12.4l-1.7 2.4M9.4 9.4l-2.7-1" />
    </Svg>
  );
}

export function AssistIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 12h13" />
      <path d="M12.5 7.5L17 12l-4.5 4.5" />
      <circle cx="20" cy="12" r="1.4" fill="currentColor" />
    </Svg>
  );
}

export function CardIcon({ className }: IconProps) {
  return (
    <Svg className={className} filled>
      <rect x="7" y="4" width="10" height="16" rx="1.6" />
    </Svg>
  );
}

export function SubIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 20V6M8 6L5 9M8 6l3 3" />
      <path d="M16 4v14M16 18l3-3M16 18l-3-3" />
    </Svg>
  );
}

export function WhistleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M13.5 9H21v3a5 5 0 1 1-7-4.6z" />
      <circle cx="8.5" cy="14" r="2" />
      <path d="M15 6l1.5-1.5" />
    </Svg>
  );
}

export function PenaltyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </Svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l7 2.5v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V5.5z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 5H4v1.5A3.5 3.5 0 0 0 7 10M17 5h3v1.5A3.5 3.5 0 0 1 17 10" />
      <path d="M12 13v3M9 20h6M10 20l.5-4h3l.5 4" />
    </Svg>
  );
}

export function SignalIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12.5a9 9 0 0 1 14 0M8 15.5a5 5 0 0 1 8 0" />
      <circle cx="12" cy="18.5" r="1.2" fill="currentColor" />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-3M12 16v-7M16 16v-5M20 16V7" />
    </Svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.1" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1.1" fill="currentColor" />
    </Svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <Svg className={className} filled>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />
    </Svg>
  );
}

export function FootballIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.2l3 2.2-1.1 3.4h-3.8L9 10.4z" />
      <path d="M12 8.2V4.8M15 10.4l3.3-1.1M13.9 13.8l2 2.9M10.1 13.8l-2 2.9M9 10.4l-3.3-1.1" />
    </Svg>
  );
}

export function BasketballIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5v17" />
      <path d="M5.6 6.1c2 2 3 4 3 5.9s-1 3.9-3 5.9M18.4 6.1c-2 2-3 4-3 5.9s1 3.9 3 5.9" />
    </Svg>
  );
}

export function CricketIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14.5 4.5L19.5 9.5" />
      <path d="M13 6L4.5 14.5a2.1 2.1 0 0 0 3 3L16 9" />
      <circle cx="18" cy="6" r="2" />
      <path d="M5 19l-1.5 1.5" />
    </Svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="5.5" width="16" height="15" rx="1.8" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" />
    </Svg>
  );
}

// Maps a feeder event type to its icon + accent colour. Unknown types fall back
// to a neutral dot so the timeline still renders every event gracefully.
export type EventVisual = {
  Icon: (props: IconProps) => React.ReactElement;
  color: string;
  label: string;
};

const EVENT_VISUALS: Record<string, EventVisual> = {
  goal: { Icon: GoalIcon, color: "#00ff88", label: "Goal" },
  assist: { Icon: AssistIcon, color: "#00d4ff", label: "Assist" },
  yellow_card: { Icon: CardIcon, color: "#ffd86b", label: "Yellow Card" },
  red_card: { Icon: CardIcon, color: "#ff3b5c", label: "Red Card" },
  substitution: { Icon: SubIcon, color: "#a0a0aa", label: "Substitution" },
  penalty: { Icon: PenaltyIcon, color: "#e2c368", label: "Penalty" },
  own_goal: { Icon: GoalIcon, color: "#ff3b5c", label: "Own Goal" },
  clean_sheet: { Icon: ShieldIcon, color: "#00d4ff", label: "Clean Sheet" },
};

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function eventVisual(type: string): EventVisual {
  const key = type.toLowerCase();
  return (
    EVENT_VISUALS[key] ?? {
      Icon: WhistleIcon,
      color: "#a0a0aa",
      label: titleCase(type),
    }
  );
}
