import Link from "next/link";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/classUtils";
import { SPORT_GLYPHS } from "@/components/landing/sport-icons";
import type { LandingHeroContent } from "@/components/landing/landing-hero/types";

type LeftContentProps = {
  content: LandingHeroContent;
};

const HERO_STATS = [
  { value: "50K+", label: "Managers" },
  { value: "3", label: "Sports" },
  { value: "4.9★", label: "Rating" },
];

export function LeftContent({ content }: LeftContentProps) {
  const titleLines = content.title.split("\n");

  return (
    <div className="float-up max-w-2xl">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft shadow-xs">
        <span className="size-1.5 rounded-full bg-primary animate-live-pulse" />
        {content.badge}
      </span>

      <h1
        id="landing-hero-title"
        className="mt-7 font-condensed text-6xl font-bold uppercase leading-[0.88] tracking-[-0.015em] text-ink md:text-8xl"
      >
        {titleLines.map((line, idx) => (
          <span
            key={line}
            className={cn(
              "block",
              idx === titleLines.length - 1 && "text-primary",
            )}
          >
            {line}
          </span>
        ))}
      </h1>

      <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted md:text-lg">
        {content.description}
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        {content.ctas.map((cta) => {
          const isPrimary = cta.variant === "primary";

          return (
            <Link key={cta.label} href={cta.href} className="hover:no-underline">
              <Button
                variant={isPrimary ? "primary" : "outline"}
                size="lg"
                className="h-12 min-w-40 px-7 text-sm"
              >
                {!isPrimary ? (
                  <Play className="mr-1 h-4 w-4" aria-hidden="true" />
                ) : null}
                {cta.label}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Sport chips */}
      <div className="mt-8 flex flex-wrap items-center gap-2.5">
        {SPORT_GLYPHS.map(({ Icon, label, color }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 shadow-xs"
          >
            <span style={{ color }}>
              <Icon className="size-4" />
            </span>
            <span className="font-condensed text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft">
              {label}
            </span>
          </span>
        ))}
      </div>

      {/* Premium stat trio */}
      <div className="mt-9 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-7">
        {HERO_STATS.map((stat) => (
          <div key={stat.label}>
            <div className="stat-num num text-3xl">{stat.value}</div>
            <div className="micro-label mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
